---
layout: post
title:  "How to properly make list-like objects in Python"
date:   2020-08-29 15:00:00 +0300
categories: programming python
---

In this post we will be talking about how Python likes to deal with "list-like
objects". We will be diving into some quirks of Python that might seem a bit
weird and, in the end, hopefully teach you how to build something that could
actually be useful while avoiding common mistakes.

# Part 1: Fake lists

Lets start with this snippet.

```python
class FakeList:
    def __getitem__(self, index):
        if index == 0:
            return "zero"
        elif index == 1:
            return "one"
        elif index == 2:
            return "two"
        elif index == 3:
            return "three"
        elif index == 4:
            return "four"
        elif index == 5:
            return "five"
        elif index == 6:
            return "six"
        else:
            raise IndexError(index)

f = FakeList()
```

A lot of people will be familiar with this:

```python
f[3]
# <<< 'three'
```

`__getitem__` is the method you override if you want your instances to respond
to the square bracket notation. Essentially `f[3]` is equivalent to
`f.__getitem__(3)`.

What you may not know, is this:

```python
for i, n in enumerate(f):
    print(i, n)
# 0 zero
# 1 one
# 2 two
# 3 three
# 4 four
# 5 five
# 6 six

list(f)
# <<< ['zero', 'one', 'two', 'three', 'four', 'five', 'six']
```

or this:

```python
'three' in f
# <<< True
'apple' in f
# <<< False
```

Before I explain what I _think_ is going on, lets try to tweak the snippet to
see how it reacts:

```diff
 class FakeList:
     def __getitem__(self, index):
         if index == 0:
             return "zero"
         elif index == 1:
             return "one"
         elif index == 2:
             return "two"
         elif index == 3:
             return "three"
-        elif index == 4:
-            return "four"
         elif index == 5:
             return "five"
         elif index == 6:
             return "six"
         else:
             raise IndexError(index)
```

```python
f = FakeList()
list(f)
```

Although this would be a reasonable outcome:

```python
list(f)
# <<< ['zero', 'one', 'two', 'three', 'five', 'six']  # wrong
```

It turns out that the actual result is this:

```python
list(f)
# <<< ['zero', 'one', 'two', 'three']
```

Lets try another tweak now:

```diff
 class FakeList:
     def __getitem__(self, index):
         if index == 0:
             return "zero"
         elif index == 1:
             return "one"
         elif index == 2:
             return "two"
         elif index == 3:
             return "three"
         elif index == 4:
             return "four"
         elif index == 5:
             return "five"
         elif index == 6:
             return "six"
-        else:
-            raise IndexError(index)
```

```python
f = FakeList()
list(f)
```

If you try to run this, it will get stuck and you will have to stop it with
ctrl-c. To see why this is the case, lets tweak some more:

```python
for i, n in enumerate(f):
    print(i, n)
    input("Press Enter to continue")

# 0 zero
# Press Enter to continue
# 1 one
# Press Enter to continue
# 2 two
# Press Enter to continue
# 3 three
# Press Enter to continue
# 4 four
# Press Enter to continue
# 5 five
# Press Enter to continue
# 6 six
# Press Enter to continue
# 7 None
# Press Enter to continue
# 8 None
# Press Enter to continue
# 9 None
# Press Enter to continue
# 10 None
# Press Enter to continue
# 11 None
# Press Enter to continue
# ...
```

And our final tweak:

```diff
 class FakeList:
     def __getitem__(self, index):
         if index == 0:
             return "zero"
         elif index == 1:
             return "one"
         elif index == 2:
             return "two"
         elif index == 3:
+            3 / 0
             return "three"
         elif index == 4:
             return "four"
         elif index == 5:
             return "five"
         elif index == 6:
             return "six"
         else:
             raise IndexError(index)
```

```python
f = FakeList()
for i, n in enumerate(f):
    print(i, n)

# 0 zero
# 1 one
# 2 two
# ZeroDivisionError: divison by zero
```

With all of this in mind, lets try to figure out what Python does when you try
to iterate over an object. The steps are, in order:

1. See if object has an `__iter__` method. If it does, call it and `yield` the
   results.

2. See if the object has a `__next__` method. If it does, call it repeatedly,
   `yield` each result until at some point it raises a `StopIteration`
   exception.

   It would be reasonable to assume that Python would give up at this point,
   but it looks like it has yet another trick up its sleeve:

3. See if the object has a `__getitem__` method. If it does:

   - Call it with `0`, `yield` the result
   - Call it with `1`, `yield` the result
   - Call it with `2`, `yield` the result
   - and so on

   - If at some point you get an `IndexError`, stop the iteration
   - If at some point you get any other exception, raise it

This explains all our examples:

- When we removed the `elif index == 4` part, it went straight to the
  `IndexError` and stopped the iteration
- When we removed the `raise IndexError(index)` part, it went to the end of the
  body of the method, which in Python means that the method returns `None`;
  `None` is a perfectly acceptable value for `__getitem__` to return, so the
  iteration went on forever
- When we injected a `3 / 0` somewhere, it raised a `ZeroDivisionError` in the
  middle of the iteration

Lets now revert to our first example, the "correct" one, and try throwing some
more curveballs at it:

```python
len(f)
# TypeError: object of type 'FakeList' has no len()

list(reversed(f))
# TypeError: object of type 'FakeList' has no len()
```

To be honest, the first time I tried these, I expected `len()` to work. Python
would simply have to try an iteration and count how many steps it took to reach
an `IndexError`. But it doesn't. It probably makes sense since iterable
sequences may also be infinite sequences and Python would get stuck. The fact
that `reversed()` doesn't work wasn't surprizing, especially since `len()`
didn't work.  How would Python know where to start? In fact, when we called
`reversed()`, Python complained about the missing `len()` of `FakeList`, not
`reversed()`. But it seems that we can fix both problems by adding `len()` to
our `FakeList`:

```diff
 class FakeList:
     def __getitem__(self, index):
         if index == 0:
             return "zero"
         elif index == 1:
             return "one"
         elif index == 2:
             return "two"
         elif index == 3:
             return "three"
         elif index == 4:
             return "four"
         elif index == 5:
             return "five"
         elif index == 6:
             return "six"
         else:
             raise IndexError(index)
 
+    def __len__(self):
+        return 7
```

```python
f = FakeList()
len(f)
# <<< 7

list(reversed(f))
# <<< ['six', 'five', 'four', 'three', 'two', 'one', 'zero']
```

So, to sum up. What can we do with our `FakeList` object?

1. We can use the square bracket notation (no surprises there):
   `f[3] == "three"`
2. We can call `len()` on it (again, no surprises): `len(f) == 7`
3. We can iterate over it: `for n in f: print(n)`, `list(f)`
4. We can reverse it: `for n in reversed(f): print(n)`, `list(reversed(f))`
5. We can find things in it with `in`: `'three' in f == True`

So, our `FakeList` appears to behave like a list in almost all respects. But,
how can we be sure that we have covered all the bases? Are we missing
something? Is there a defined "interface" for "list-like objects" in Python?

# Part 2: Abstract Base Classes

Abstract Base Classes, or ABCs, are a feature of Python that is not all that
well known. There is some theory behind them, that they try to strike a balance
between "static typing", which in Python it usually means using `isinstance` a
lot to determine if a value conforms with the type you are expecting, and "duck
typing", which usually means "don't check the types of any value; instead
interact with them as if they have the type you expect, and deal with the
exceptions that will be raised if they don't conform to your expected type's
interface". ABCs introduce something that in the Python ecosystem is called
"Goose typing".

Long story short, Abstract Base Classes allow you to call
`isinstance(obj, cls)` and have it return `True`, when in fact `obj` is **not**
an instance of `cls` or one of its subclasses. Lets see it in action:

```python
class NotSized:
    def __len__(self, *args, **kwargs):
        pass

from collections.abc import Sized
isinstance(NotSized(), Sized)
# <<< True
```

You can write your own ABCs, and the theory behind why they are needed and how
they work is interesting, but it is not what I want to talk about here.
Because, apart from defying `isinstance`, they also have some functionality
built in. If you visit the [documentation page of
`collections.abc`][collections-abc-docs], you will see the following section:

| ABC        | Inherits from              | Abstract methods         | Mixin methods                                                   |
|------------|----------------------------|--------------------------|-----------------------------------------------------------------|
| ...        | ...                        | ...                      | ...                                                             |
| `Sequence` | `Reversible`, `Collection` | `__getitem__`, `__len__` | `__contains__`, `__iter__`, `__reversed__`, `index`, `count` |
| ...        | ...                        | ...                      | ...                                                             |

This tells us the following: If your class subclasses `Sequence` and defines
the `__getitem__` and `__len__` methods, then:

1. calling `isinstance(obj, Sequence)` will return `True` and
2. they will also have the other 5 methods: `__contains__`, `__iter__`,
   `__reversed__`, `index` and `count`

_(You can verify the second statement by checking out
[the source code of `Sequence`][collections-abc-code]; it's neither big nor
complicated)_

The first statement is not really surprising, but it is important because it
turns out that `isinstance(obj, Sequence) == True` is the "official" way of
saying that `obj` is a readable list-like object in Python.

What is interesting here is that, even without subclassing from `Sequence`,
Python already gave `__contains__`, `__iter__` and `__reversed__` to our
`FakeList` class from _Part 1_. Lets put the last two mixin methods to the
test:

```python
f.index('two')
# AttributeError: 'FakeList' object has no attribute 'index'

f.count('two')
# AttributeError: 'FakeList' object has no attribute 'count'
```

We can fix this by subclassing `FakeList` from `Sequence`

```diff
+from collections.abc import Sequence
 
-class FakeList:
+class FakeList(Sequence):
     def __getitem__(self, index):
 ...
```

```python
f.index('two')
# <<< 2

f.count('two')
# <<< 1
```

So the bottom line of all this is:

> **If you want to make something that can be "officially" considered a readable
> list-like object in Python, make it subclass `Sequence` and implement at
> least the `__getitem__` and `__len__` methods**

The same conclusion holds true for all the ABCs listed in the
[documentation][collections-abc-docs]. For example, if you want to make a fully
legitimate read-**write** list-like object, you would simply have to subclass
from `MutableSequence` and implement the `__getitem__`, `__len__`,
`__setitem__`, `__detitem__` and `insert` methods (the ones in the 'Abstract
methods' column).

There is a note in the [documentation][collections-abc-docs] which is
interesting, so we are going to include it here verbatim:

> Implementation note: Some of the mixin methods, such as `__iter__()`,
> `__reversed__()` and `index()`, make repeated calls to the underlying
> `__getitem__()` method. Consequently, if `__getitem__()` is implemented with
> constant access speed, the mixin methods will have linear performance;
> however, if the underlying method is linear (as it would be with a linked
> list), the mixins will have quadratic performance and will likely need to be
> overridden.

# Part 3: Chainable methods

We are going to shift topics away from list-like objects now. Don't worry,
everything will come together in the end. Lets make another useless class.

```python
class Counter:
    def __init__(self):
        self._count = 0

    def increment(self):
        self._count += 1

    def __repr__(self):
        return f"<Counter: {self._count}>"

c = Counter()
c.increment()
c.increment()
c.increment()
c
# <<< <Counter: 3>
```

Nothing surprising here. 

It would be nice if we could make the `.increment` calls chainable, ie, if we
could do:

```python
c = Counter().increment().increment().increment()
c
# <<< <Counter: 3>
```

The easiest way to accomplish this is to have `.increment()` return the
`Counter` object itself:

```diff
 class Counter:
     def __init__(self):
         self._count = 0

     def increment(self):
         self._count += 1
+        return self

     def __repr__(self):
         return f"<Counter: {self._count}>"
```

However, this is not advisable. Here is an [email][guido-email] from Guido van
Rossum (the creator of Python) from 2003:

> I'd like to explain once more why I'm so adamant that sort() shouldn't return
> 'self'.
> 
> This comes from a coding style (popular in various other languages, I believe
> especially Lisp revels in it) where a series of side effects on a single
> object can be chained like this:
> 
>     x.compress().chop(y).sort(z)
> 
> which would be the same as
> 
>     x.compress()
>     x.chop(y)
>     x.sort(z)
> 
> I find the chaining form a threat to readability; it requires that the reader
> must be intimately familiar with each of the methods.  The second form makes
> it clear that each of these calls acts on the same object, and so even if you
> don't know the class and its methods very well, you can understand that the
> second and third call are applied to x (and that all calls are made for their
> side-effects), and not to something else.
> 
> I'd like to reserve chaining for operations that return new values, like
> string processing operations:
> 
>     y = x.rstrip("\n").split(":").lower()
> 
> There are a few standard library modules that encourage chaining of
> side-effect calls (pstat comes to mind).  There shouldn't be any new ones;
> pstat slipped through my filter when it was weak.
> 
> --Guido van Rossum (home page: http://www.python.org/~guido/)

Here is how I interpret this. If someone reads this snippet:

```python
obj.do_something()
```

they will assume that `.do_something()`:

- mutates `obj` in some way, and/or
- has an interesting side-effect
- probably returns `None`

When they read this snippet:

```python
obj2 = obj1.do_something()
```

they will assume that:

- `.do_something()` does not change `obj1` in any way
- `obj2` will have a new value, either a different type (eg a result status) or
  a slightly mutated copy of `obj1`

These assumptions break down when methods `return self`:

```python
c1 = Counter().increment()
c2 = c1.increment()

c1
# <<< <Counter: 2>
c2
# <<< <Counter: 2>
c1 == c2
# <<< True
```

Someone not familiar with the implementation of `Counter` would assume that
`c1` would hold the value `1`.

How do we _fix_ this? My suggestion is: make the class's initializer accept any
optional arguments required to fully describe the instance's state. Then,
chainable methods will return a new instance with the appropriate, slightly
changed, state.

```diff
 class Counter:
-    def __init__(self):
-        self._count = 0
+    def __init__(self, count=0):
+        self._count = count

     def increment(self):
-        self._count += 1
-        return self
+        return Counter(self._count + 1)

     def __repr__(self):
         return f"<Counter: {self._count}>"
```

Lets try it out:

```python
c1 = Counter().increment()
c2 = c1.increment()

c1
# <<< <Counter: 1>
c2
# <<< <Counter: 2>
c1 == c2
# <<< False
```

It might be a little better if we also do this:

```diff
 class Counter:
     def __init__(self, count=0):
         self._count = count

     def increment(self):
-        return Counter(self._count + 1)
+        return self.__class__(self._count + 1)

     def __repr__(self):
         return f"<Counter: {self._count}>"
```

so that `.increment()` works for subclasses of `Counter`.

We essentially made the `Counter` objects **immutable**, unless someone changes
the _"private"_ `_count` attribute by hand.

# Part 4: Bringing everything together

It's now time to build something actually useful. Lets consume an API and
access the responses like lists. We are going to use the
[Transifex API (v3)][transifex-api]. Lets start with a snippet:

```python
import os
import requests

class TxCollection:
    HOST = "https://rest.api.transifex.com"

    def __init__(self, url):
        response = requests.get(
            self.HOST + url,
            headers={'Content-Type': "application/vnd.api+json",
                     'Authorization': f"Bearer {os.environ['API_TOKEN']}"},
        )
        response.raise_for_status()
        self.data = response.json()['data']
```

```python
organizations = TxCollection("/organizations")
organizations.data[0]['attributes']['name']
# <<< 'diegobz'
```

Now lets make this behave like a list:

```diff
-import os
+import os, reprlib, collections
 import requests
 
-class TxCollection:
+class TxCollection(collections.abc.Sequence):
     HOST = "https://rest.api.transifex.com"
 
     def __init__(self, url):
         response = requests.get(
             self.HOST + url,
             headers={'Content-Type': "application/vnd.api+json",
                      'Authorization': f"Bearer {os.environ['API_TOKEN']}"},
         )
         response.raise_for_status()
-        self.data = response.json()['data']
+        self._data = response.json()['data']
 
+    def __getitem__(self, index):
+        return self._data[index]
+
+    def __len__(self):
+        return len(self._data)
+
+    def __repr__(self):
+        result = ", ".join((reprlib.repr(item['id']) for item in self))
+        result = f"<TxCollection ({len(self)}): {result}>"
+        return result
```

```python
organizations = TxCollection("/organizations")
organizations
# <<< <TxCollection (3): 'o:diegobz', 'o:kb_org', 'o:transifex'>

organizations[2]
# <<< {'id': 'o:transifex',
# ...  'type': 'organizations',
# ...  'attributes': {
# ...   'name': 'Transifex',
# ...   'slug': 'transifex',
# ...   'logo_url': 'https://txc-assets-775662142440-prod.s3.amazonaws.com/mugshots/435381b2e0.jpg',
# ...   'private': False},
# ...  'links': {'self': 'https://rest.api.transifex.com/organizations/o:transifex'}}
```

What is interesting here is that we _know_ that our class is a legitimate
readable list-like object because we fulfilled the requirements we set in _Part
2_: we subclassed from `collections.abc.Sequence` and implemented the
`__getitem__` and `__len__` methods.

Now, if you are familiar with Django querysets, you will know that you can
apply filters to them and that their evaluation is applied
[lazily][django-querysets-are-lazy], ie evaluated on demand, after the filters
have been set. Lets try to apply this logic here, first by making our
collections lazy:

```diff
 import os, reprlib, collections
 import requests
 
 class TxCollection(collections.abc.Sequence):
     HOST = "https://rest.api.transifex.com"
 
     def __init__(self, url):
         self._url = url
+        self._data = None
 
+    def _evaluate(self):
+        if self._data is not None:
+            return
         response = requests.get(
             self.HOST + self._url,
             headers={'Content-Type': "application/vnd.api+json",
                      'Authorization': f"Bearer {os.environ['API_TOKEN']}"},
         )
         response.raise_for_status()
         self._data = response.json()['data']
 
     def __getitem__(self, index):
+        self._evaluate()
         return self._data[index]
 
     def __len__(self):
+        self._evaluate()
         return len(self._data)
 
     def __repr__(self):
         result = ", ".join((reprlib.repr(item['id']) for item in self))
         result = f"<TxCollection ({len(self)}): {result}>"
         return result
```

```python
organizations = TxCollection("/organizations")
organizations
# <<< <TxCollection (3): 'o:diegobz', 'o:kb_org', 'o:transifex'>
```

Our _lazy_ evaluation:

1. Will only be triggered when we try to access the collection like a list
2. Will abort early if the collection has already been evaluated

To drive point 1 home, I will point out that our `__repr__` method (the one
that was called when we typed `organizations <ENTER>` into our python terminal)
does **not** explicitly trigger an evaluation, but triggers it nevertheless.
The `for item in self` part in its first line will start an iteration, which
will call `__getitem__` (as we saw in _Part 1_), which will trigger the
evaluation.  Even if it didn't, the `len(self)` part in the second line would
also trigger the evaluation.

Playing with metaprogramming, which in this context means making things behave
like things that they are not, can be tricky, dangerous and cause bugs, as
anyone who has played with `__setattr__` and ran into `RecursionError`s can
attest to. This is the beauty of the conclusion from _Part 2_: we want to make
`TxCollection` behave like a list and we know **exactly** which parts of the
code trigger that behaviour: `__getitem__` and `__len__`. That's the **only**
parts we need to add our lazy evaluation to in order to be 100% confident that
`TxCollection` will properly behave like a readable list.

Now lets apply filtering. We will intentionally do it the _wrong_ way, by
returning `self`, so that we can see the flaws outlined in _Part 3_ in the
context of this example. Then we will fix it.

```diff
 class TxCollection(collections.abc.Sequence):
     HOST = "https://rest.api.transifex.com"

     def __init__(self, url):
         self._url = url
+        self._params = {}

         self._data = None

     def _evaluate(self):
         if self._data is not None:
             return
         response = requests.get(
             self.HOST + self._url,
+            params=self._params,
             headers={'Content-Type': "application/vnd.api+json",
                      'Authorization': f"Bearer {os.environ['API_TOKEN']}"},
         )
         response.raise_for_status()
         self._data = response.json()['data']
 
+    def filter(self, **filters):
+        self._params.update({f'filter[{key}]': value
+                             for key, value in filters.items()})
+        return self

     # def __getitem__, __len__, __repr__
```

Lets take this out for a spin:

```python
TxCollection("/resource_translations").\
    filter(resource="o:kb_org:p:kb1:r:fileless", language="l:el")
# <<< <TxCollection (3): 'o:kb_org:p:k...72e4fdb0:l:el',
# ...                    'o:kb_org:p:k...e877d7ee:l:el',
# ...                    'o:kb_org:p:k...ed953f8f:l:el'>
```

_(Note: There are some Transifex-API-v3-specific things here, like how
filtering is applied and what the IDs of the objects look like, that you don't
have to worry about. If you are interested, you can check out [the
documentation][transifex-api])_

And now lets demonstrate the flaw we outlined in _Part 3_

```python
c1 = TxCollection("/resource_translations").\
    filter(resource="o:kb_org:p:kb1:r:fileless", language="l:el")
c2 = c1.filter(translated="true")

c1
# <<< <TxCollection (1): 'o:kb_org:p:k...72e4fdb0:l:el'>
c2
# <<< <TxCollection (1): 'o:kb_org:p:k...72e4fdb0:l:el'>
c1 == c2
# <<< True
```

We know from our previous run that `c1` should have a size of 3, but it got
overwritten when we applied `.filter()` to it.

Also,

```python
c1 = TxCollection("/resource_translations").\
    filter(resource="o:kb_org:p:kb1:r:fileless", language="l:el")
_ = list(c1)
c2 = c1.filter(translated="true")

c1
# <<< <TxCollection (3): 'o:kb_org:p:k...72e4fdb0:l:el',
# ...                    'o:kb_org:p:k...e877d7ee:l:el',
# ...                    'o:kb_org:p:k...ed953f8f:l:el'>
c2
# <<< <TxCollection (3): 'o:kb_org:p:k...72e4fdb0:l:el',
# ...                    'o:kb_org:p:k...e877d7ee:l:el',
# ...                    'o:kb_org:p:k...ed953f8f:l:el'>
c1 == c2
# <<< True
```

We forced an evaluation **before** we applied the second filter (with
`_ = list(c1)`), so the second filter was ignored, in both `c1` and `c2`.

To fix this, we will do the same thing we did in _Part 3_: we will add optional
arguments to the initializer that describe the whole state of a `TxCollection`
object and have `.filter()` return a slightly mutated copy of `self`.

```diff
 class TxCollection(collections.abc.Sequence):
     HOST = "https://rest.api.transifex.com"
 
-    def __init__(self, url):
+    def __init__(self, url, params=None):
+        if params is None:
+            params = {}

         self._url = url
-        self._params = {}
+        self._params = params

         self._data = None

     # def _evaluate
 
-    def filter(self, **filters):
-        self._params.update({f'filter[{key}]': value
-                             for key, value in filters.items()})
-        return self
+    def filter(self, **filters):
+        params = dict(self._params)  # Make a copy
+        params.update({f'filter[{key}]': value
+                       for key, value in filters.items()})
+        return self.__class__(self._url, params)

     # def __getitem__, __len__, __repr__
```

_(Note: we didn't set `params={}` as the default value in the initializer
because [you shouldn't use mutable default arguments][wtf-python])_

```python
c1 = TxCollection("/resource_translations").\
    filter(resource="o:kb_org:p:kb1:r:fileless", language="l:el")
c2 = c1.filter(translated="true")

c1
# <<< <TxCollection (3): 'o:kb_org:p:k...72e4fdb0:l:el',
# ...                    'o:kb_org:p:k...e877d7ee:l:el',
# ...                    'o:kb_org:p:k...ed953f8f:l:el'>
c2
# <<< <TxCollection (1): 'o:kb_org:p:k...72e4fdb0:l:el'>
c1 == c2
# <<< False
```

Works like a charm!

We concluded _Part 3_ by saying that the class we made creates immutable
objects, which is why it is safe to use chainable methods on them. What is
interesting here is that `TxCollection` objects are **not** immutable. So, how
do we ensure that implementing chainable methods is safe? The answer is that
the state of a `TxCollection` consists of two parts:

- The `_url` and `_params` attributes that **are** immutable.

- The `_data` attribute which is dynamic. **But**:

    1. it will only be evaluated **once** and

    2. it has a **deterministic** relationship with the immutable parts. The
       **only** way for `_data` to be evaluated differently is to change `_url`
       and `_params`, which can only happen if we make a mutated copy of the
       original object via `.filter()`

# Conclusion

I hope this has been interesting. You can write powerful and expressive code
with what is explained here, hopefully without introducing bugs.


[collections-abc-docs]: https://docs.python.org/3/library/collections.abc.html
[collections-abc-code]: https://github.com/python/cpython/blob/3.8/Lib/_collections_abc.py#L856
[guido-email]: https://mail.python.org/pipermail/python-dev/2003-October/038855.html
[transifex-api]: https://transifex.github.io/openapi/
[django-querysets-are-lazy]: https://docs.djangoproject.com/en/3.1/topics/db/queries/#querysets-are-lazy
[wtf-python]: https://github.com/satwikkansal/wtfpython#-beware-of-default-mutable-arguments
