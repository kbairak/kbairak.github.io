---
layout: post
title:  "More about executors"
date:   2020-10-26 21:00:00 +0300
categories: programming python
---

Back in my [Things I Don't Like][things-i-dont-like] post, I mentioned that I
don't like the word 'executor' when it appears in code. As a counter-example I
posted this:

> I get it. Normally you would have to define a function with a hundred
> arguments. So it might seem better to you if you do things like this:
>
> ```python
> class FooExecutor:
>     def __init__(self, arg1, arg2, arg3, arg4):
>         self.arg1 = arg1
>         self.arg2 = arg2
>         self.arg3 = arg3
>         self.arg4 = arg4
> 
>     def prepare(self, arg5, arg6, arg7):
>         self.arg5 = arg5
>         self.arg6 = arg6
>         self.arg7 = arg7
> 
>     def execute(self, arg8, arg9, arg10):
>         # ...
>
> executor = FooExecutor(1, 2, 3, 4)
> executor.prepare(5, 6, 7)
> result = executor.do(8, 9, 10)
> ```
>
> If this looks like the best thing you can do, then there's something wrong
> with the overall design. You need to take a step back, take a deep breath and
> refactor your code so that it makes more sense.

I realise, however, that I would be horribly misleading if I pretended that
handling large amounts of arguments is the _only_ reason that people use a
pattern like this. This is obviously not the case.

So, let me come up with other reasons someone would use a pattern like the
above, and why I still dislike it.

## Inheritance

```python
class FooBaseExecutor:
    def __init__(self, ...):
        ...

    def step1(self):
        raise NotImplementedError

    def step2(self):
        raise NotImplementedError

    def step3(self):
        raise NotImplementedError

    def step4(self):
        raise NotImplementedError

    def step5(self):
        raise NotImplementedError

    def execute(self):
        self.step1()
        self.step2()
        self.step3()
        self.step4()
        self.step5()
```

On top of this you can create a hierarchy of subclasses, each contributing part
of the overall functionality. In the end, the user will be able to pick the
appropriate Executor class and do the work they need:

```python
class FooOneExecutor(FooBaseExecutor):
    def step1(self):
        ...

    def step2(self):
        ...

class FooTwoExecutor(FooOneExecutor):
    def step3(self):
        ...

class FooThreeExecutor(FooTwoExecutor):
    def step4(self):
        ...

    def step5(self):
        ...

class FooFourExecutor(FooTwoExecutor):
    def step4(self):
        ...

    def step5(self):
        ...
```

etc. You can also employ mixins that provide these `stepX` methods if it makes
more sense, depending on the use-case.

In "userland", these would be invoked as:

```python
from .executors import FooThreeExecutor, FooFourExecutor

result1 = FooThreeExecutor(...).execute()
result2 = FooFourExecutor(...).execute()
```

A popular example of this approach is
[Django's class-based views][class-based-views].

Far from me to claim that my approach would be better than something that the
Django developers have come up with. So I will concede to this: _"Maybe, under
certain circumstances, this approach is better, but I still dislike it and I
wish another alternative was possible"_.

So, what would I prefer?

I am a big fan of the "one-two-three" approach to programming. ie _"Just do
what you want to do, in the order you want to do it. You can delegate parts of
your logic, especially parts that repeat, to functions, but each function
should be deterministic (ie return a predictable result based on its arguments,
without maintaining an internal state). Avoid delegating to methods of classes
you don't have easy access to or to callbacks that are passed as arguments."_

Under this approach, the "userland" code would look like this:

```python
from .steps import (step1, step2, step3, step4, step5,
                    alternative_step4, alternative_step5)

result_1 = step1(...)
result_1 = step2(result_1)
result_1 = step3(result_1)

result_1 = step4(result_1)
result_1 = step5(result_1)

result_2 = step1(...)
result_2 = step2(result_2)
result_2 = step3(result_2)

result_2 = alternative_step4(result_2)
result_2 = alternative_step5(result_2)
```

Here we have an obvious trade-off. The former example has more complicated code
on the library side and simpler code on the "userland" side while the latter
example has the exact opposite. Which is why, if someone decides to go for the
former approach, I will not conclude that they were "wrong" and I am "right",
but that we value things differently and that it is subjective.

In defence of my preferred approach:

1. If the names, arguments, return values and docstrings, ie the **interface**,
   of the `stepX` functions are good, the "userland" code is not that hard to
   look at. Good function names also negate the need for comments while I can
   hardly imagine invocations of the Executor classes not needing comments.

2. Debugging code written using the executor approach can be a big pain.
   Imagine landing on the `step3` method of a mixin class inside a debugger.
   You have no easy way to determine which class inherited the class you are
   currently viewing and if you see a `self.step4()` invocation, you can't
   easily know which flavor of `step4` is about to be executed. This is coming
   from someone who has spent a lot of time inside debuggers during my career.

## Callbacks

[things-i-dont-like]: {% post_url 2020-10-11-things_i_dont_like %}
[class-based-views]: https://docs.djangoproject.com/en/3.1/topics/class-based-views/intro/
