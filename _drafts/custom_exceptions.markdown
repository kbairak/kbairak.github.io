---
layout: post
title:  "Consistent custom exception classes in Python"
date:   2020-09-23 18:00:00 +0300
categories: programming python
---

Having to handle exceptions is common in Python and so is having to define your
own. Yet, I have seen competing ways of doing so in various projects. The
inconsistency comes from `Exception`s being something that can easily be
subclassed and extended, but also something that can be easily instantiated and
used in their base form.

Here is a common way to define custom exceptions in Python:

```python
class MyException(Exception):
    def __init__(self, msg):
        self.msg = msg

try:
    raise MyException("Something went wrong")
except MyException as e:
    print(e)        # <<< Something went wrong
    print(repr(e))  # <<< MyException('Something went wrong')
```

In general, this seems to work fine. In fact, it works "better than it should".
_Somehow_, Python knows how to properly execute the `str` and `repr` methods,
even though we didn't write any code for them.

So is there a problem with this approach? Let's try something slightly
different:

```python
# Same as before
class MyException(Exception):
    def __init__(self, msg):
        self.msg = msg

try:
    # Now we use a keyword argument
    raise MyException(msg="Something went wrong")
except MyException as e:
    print(e)        # <<<
    print(repr(e))  # <<< MyException()
```

Oh no! Looks like we broke the `str` and `repr` methods. How did this happen?

Although nothing prevents us from assigning attributes to an `Exception` object
(the `self.msg = msg` part), there is a special place in `Exception`'s heart
for the constructor's positional arguments:

```python
e = Exception(1, 2, 3)

e.__dict__  # <<< {}
e.args      # <<< (1, 2, 3)
str(e)      # <<< '(1, 2, 3)'
repr(e)     # <<< 'Exception(1, 2, 3)'

e.a = 'b'
e.__dict__  # <<< {'a': 'b'}
e.args      # <<< (1, 2, 3)
str(e)      # <<< '(1, 2, 3)'
repr(e)     # <<< 'Exception(1, 2, 3)'
```

But not so much for keyword arguments:

```python
e = Exception(1, b=2)
# <<< ---------------------------------------------------------------------------
# <<< TypeError                                 Traceback (most recent call last)
# <<< <ipython-input-9-0f7c585491d4> in <module>
# <<< ----> 1 e = Exception(1, b=2)
# <<<
# <<< TypeError: Exception() takes no keyword arguments
```

When we defined our own `__init__` method, making it able to accept the `msg`
keyword argument, there was a difference between the resulting objects when we
passed positional arguments versus when we passed keyword arguments. In short,
the following look like they should be identical, but they aren't:

```python
MyException("Something went wrong").args      # <<< ('Something went wrong',)
MyException(msg="Something went wrong").args  # <<< ()
```

_(I suspect that there is some sort of "pre-initializer" in the base
`Exception` class, possibly a `__new__` method, that captures the positional
arguments to the `args` attribute and then invokes our `__init__` method)_

One thing we could do to fix this inconsistency is implement the methods we
"broke":

```python
class MyException(Exception):
    def __init__(self, msg):
        self.msg = msg

    def __str__(self):
        return self.msg

    def __repr__(self):
        return f"MyException({self.msg})"

e = MyException(msg='Something went wrong')

str(e)   # <<< 'Something went wrong'
repr(e)  # <<< MyException('Something went wrong')
```

However this is not my suggestion. First of all, it's boring. But I also feel
like it goes against the "spirit" of how Python exceptions are supposed to be
structured. Maybe some exception handling code later on will inspect the `args`
attribute, expecting relevant information to be there.

What I propose is the following:

```python
class MyException(Exception):
    def __init__(self, msg):
        super().__init__(msg)

    @property
    def msg(self):
        return self.args[0]
```

This way, you can initialize the exception with either positional or keyword
arguments and it will behave the same way:

```python
e = MyException(msg='Something went wrong')

e.__dict__  # <<< {}
e.args      # <<< ('Something went wrong',)
e.msg       # <<< 'Something went wrong'
str(e)      # <<< 'Something went wrong'
repr(e)     # <<< "MyException('Something went wrong')"
```

However, now you can't change the `msg` attribute/property.

```python
e.msg = "Something else went wrong"
# <<< ---------------------------------------------------------------------------
# <<< AttributeError                            Traceback (most recent call last)
# <<< <ipython-input-29-32de7ec53be2> in <module>
# <<< ----> 1 e.msg = "Something else went wrong"
# <<< 
# <<< AttributeError: can't set attribute
```

Generally, **I don't see why exception objects should be mutable**, but if you
want them to be, I would suggest doing it through properties as well:

```python
class MyException(Exception):
    def __init__(self, msg):
        super().__init__(msg)

    @property
    def msg(self):
        return self.args[0]

    @msg.setter
    def msg(self, value):
        self.args = (value, )

e = MyException(msg='Something went wrong')
e.msg = "Something else went wrong"
repr(e)  # <<< "MyException('Something else went wrong')"
```

With multiple (keyword) arguments, you can do:

```python
class MyException(Exception):
    def __init__(self, msg, status_code=None):
        super().__init__(msg, status_code)

    def _set(self, position, value):
        args = list(self.args)
        args[position] = value
        self.args = tuple(args)

    msg = property(lambda self: self.args[0],
                   lambda self, value: self._set(0, value))
    status_code = property(lambda self: self.args[1],
                           lambda self, value: self._set(1, value))
```

This is a bit boilerplate-y but overall I think it's worth it to ensure the
`Exception` objects remain consistent. Things can be made better with a
utility, I guess:

```python
# utils.py
def _set(self, position, value):
    args = list(self.args)
    args[position] = value
    self.args = tuple(args)

def exc_property(position):
    return property(lambda self: self.args[position],
                    lambda self, value: _set(self, position, value))

# exceptions.py
from .utils import exc_property

class MyException(Exception):
    def __init__(self, msg, status_code=None):
        super().__init__(msg, status_code)

    msg = exc_property(0)
    status_code = exc_property(1)
```

This way, you get the `str` and `repr` method implemented for free (you can
still override them if you want), the `args` attribute will behave the same way
regardless of whether you initialize your exception with positional or keyword
arguments and you can access attributes as if they were normal attributes set
to `self` through assignment.

This looks like a lot of work, but:

1. As I said, exceptions generally have no reason to be mutable, so you
   shouldn't have to implement the setters

2. Using the `exc_property` trick, you will only write the slightly messier
   code only once, the `Exception` subclasses themselves will remain short and
   sweet
