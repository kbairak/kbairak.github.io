---
layout: post
title:  "Consistent custom exception classes in Python"
date:   2020-09-23 18:00:00 +0300
categories: programming python
---

Python exceptions really like positional arguments:

```python
e = Exception(1, 2, 3)
e.__dict__
# <<< {}
e.args
# <<< (1, 2, 3)
str(e)
# <<< '(1, 2, 3)'
```

```python
e = Exception(1, 2, 3)
e.a = 'b'
e.__dict__
# <<< {'a': 'b'}
e.args
# <<< (1, 2, 3)
str(e)
# <<< '(1, 2, 3)'
```

```python
e = Exception(1, b=2)
# <<< ---------------------------------------------------------------------------
# <<< TypeError                                 Traceback (most recent call last)
# <<< <ipython-input-9-0f7c585491d4> in <module>
# <<< ----> 1 e = Exception(1, b=2)
# <<<
# <<< TypeError: Exception() takes no keyword arguments
```

When subclassing, you can make them accept keyword arguments as you wish.
However, they still play with positional arguments as much as possible,
populating `self.args` and implementing `self.__str__` with them:

```python
class MyException(Exception):
    def __init__(self, msg):
        self.msg = msg
```

This one can be initialized either with 1 positional or 1 keyword argument.
However, there is a danger here:

```python
e = MyException(msg="hello world")
e.__dict__
# <<< {'msg': 'hello world'}
e.msg
# <<< 'hello world'
e.args
# <<< ()
str(e)
# <<< ''
```

```python
e = MyException("hello world")
e.__dict__
# <<< {'msg': 'hello world'}
e.msg
# <<< 'hello world'
e.args
# <<< ('hello world',)  # !!!
str(e)
# <<< 'hello world'  # !!!
```

I assume Exception implements `__new__` which acts as some sort of
"pre-initializer" which attaches all positional arguments to `self.args` before
calling our custom `__init__`. In the first example we only provided keyword
arguments so `Exception` wasn't able to capture `self.args`. Because the two
constructor statements, `MyException("hello world")` and
`MyException(msg="hello world")` feel like they should be doing the exact same
thing but end up doing something very different, this is a situation we should
avoid.

The solution could be overriding `__str__`, but I dislike this, because I feel
that `self.args` should also be consistent. What I propose is the following:

```python
class MyException(Exception):
    def __init__(self, msg):
        super().__init__(msg)

    @property
    def msg(self):
        return self.args[0]
```

This way, you can initialize the exception with either positional or keyword
arguments and it will behave the same way.

```python
e = MyException('hello')
e.__dict__
# <<< {}
e.args
# >>> ('hello',)
str(e)
# >>> 'hello'
e.msg
# >>> 'hello'
```

```python
e = MyException(msg='hello')
e.__dict__
# <<< {}
e.args
# >>> ('hello',)
str(e)
# >>> 'hello'
e.msg
# >>> 'hello'
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
```

With multiple (keyword) arguments, you can do:

```python
class MyException(Exception):
    def __init__(self, msg, field=None):
        super().__init__(msg, field)

    def _set(self, position, value):
        args = list(self.args)
        args[position] = value
        self.args = tuple(args)

    msg = property(lambda self: self.args[0],
                   lambda self, value: self._set(0, value))
    field = property(lambda self: self.args[1],
                     lambda self, value: self._set(1, value))
```

This is a bit boilerplate-y but overall I think it's worth it to ensure the
consistency of `__str__` and self.args. Things can be made better with a
helper, I guess:

```python
# utils.py
def _set(self, position, value):
    args = list(self.args)
    args[position] = value
    self.args = tuple(args)

def kwproperty(position):
    return property(lambda self: self.args[position],
                    lambda self, value: _set(self, position, value))

# exceptions.py
from .utils import kwproperty

class MyException(Exception):
    def __init__(self, msg, type=None):
        super().__init__(msg, type)

    msg = kwproperty(0)
    type = kwproperty(1)
```

This way, you get a `__str__` method implemented for free (you can still
override it if you want), `self.args` will behave the same way regardless of
whether you initialize your exception with positional or keyword arguments and
you can access attributes as if they were copied on self from keyword
arguments.
