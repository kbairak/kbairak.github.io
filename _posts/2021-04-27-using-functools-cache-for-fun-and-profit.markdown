---
layout: post
title:  "Using `functools.cache` for fun and profit"
date:   2021-04-27 21:00:00 +0300
categories: programming python
---

This is going to be a short post. It's just a simple "trick" in Python that I
wish I'd noticed sooner.

Stop me if you've heard this one before:

```python
class Foo:
    def __init__(self):
        self._value = None

    @property
    def value(self):
        if self._value is None:
            print("Taking a long time to calculate 5")
            self._value = 5
        return self._value
```

The idea is that calculating the `value` attribute is a costly process and you
want to only do it once, the first time it's requested.

```python
f = Foo()

f.value
# <<< Taking a long time to calculate 5
# <<< 5

f.value
# <<< 5
```

I've seen this in code written by my coworkers and I have written this type of
code, many, many, many times. Some of the snippets I'm most proud of follow
this paradigm. In fact, you can find lots of examples in this very blog.

What could be a prettier alternative?

```python
from functools import cache


class Foo:
    @property
    @cache
    def value(self):
        print("Taking a long time to calculate 5")
        return 5


f = Foo()

f.value
# <<< Taking a long time to calculate 5
# <<< 5

f.value
# <<< 5
```

It's as if `functools.cache` was made for this...

That's all folks; I told you this would be a short one.
