---
layout: post
title:  "My preferred coding style"
date:   2022-07-18 19:00:00 +0300
categories: programming python
---

Lets start with a game. I will pose a question. Then I will write a short story
with the answer to that question. Your task is to find the answer as soon as
possible. Ready? Go!

Here is the question:

> What did the fourth daughter do?

And now the story:

```
A man had five daughters. The first daughter
    went to the market. The second daughter
got married. The third daughter
    broke her ankle. The fourth daughter
visited her cousins. The fifth daughter
    played the piano.
```

Ok. Well done! Lets try that again now. Same question, different short story,
different answer:

```
A man had five daughters.
    The first daughter went to the market.
    The second daughter broke her ankle.
    The third daughter visited her cousins.
    The fourth daughter got married.
    The fifth daughter played the piano.
```

You probably didn't time yourself during this game, but I would bet that you
were able to find the answer faster with the second short story. So, what was
the point of all this?

Too often in Django, you will see an ORM query written like this:

```python
SomeModel.objects.select_for_update().filter(
    parent__parent__name="Babis",
    parent__other_parent=F("myparent"),
).exclude(married=False).values("status").annotate(
    Count("id")
).order_by("-id__count")
```

In fact, sadly, this is exactly how [Black](https://github.com/psf/black) will
format the above snippet.

My preferred style for this exact statement would be:

```python
SomeModel.objects.\
    select_for_update().\
    filter(parent__parent__name="Babis",
           parent__other_parent=F("myparent")).\
    exclude(married=False).\
    values("status").\
    annotate(Count("id")).\
    order_by("-id__count")
```

Notice how each line tells part of a story which makes the whole thing easier
to read. In fact, let me annotate this with comments to illustrate this better:

```python
# Ok, we are about to make a query now
SomeModel.objects.\
    # We are locking the rows we will retrieve until the end of the transaction
    select_for_update().\
    # Here are our filters; filter no 1
    filter(parent__parent__name="Babis",
           # Filter no 2
           parent__other_parent=F("myparent")).\
    # Now we are excluding something
    exclude(married=False).\
    # We are only interested in the 'status' field
    values("status").\
    # Or rather, we are grouping by the status field and are counting IDs per
    # distinct 'status'
    annotate(Count("id")).\
    # And finally we order by ID count, descending
    order_by("-id__count")
```

But we don't really need the comments. The code speaks for itself.

To drive the point further home, look at how ridiculus this looks:

```python
SomeModel.objects.function1().function2(
    function2_argument1,
    function2_argument2,
).function3(function3_argument).function4(function4_argument).function5(
    function5_argument
).function6(function6_argument)
```
Compared to this

```python
SomeModel.objects.\
    function1().\
    function2(function2_argument1,
              function2_argument2).\
    function3(function3_argument).\
    function4(function4_argument).\
    function5(function5_argument).\
    function6(function6_argument)
```

Some people can't stomach the backslashes at the end of lines but I think that
the value we end up getting is immense.

While we are on the subject, take a look at a couple of lines from my examples:

```python
SomeModel.objects.\
    ...
    filter(parent__parent__name="Babis",
           parent__other_parent=F("myparent")).\
    ...
```

which could have been written as:

```python
SomeModel.objects.\
    ...
    filter(
        parent__parent__name="Babis",
        parent__other_parent=F("myparent"),
    ).\
    ...
```

I am a strong believer that reading code is a more valuable skill to a
programmer than writing code. The heavier indentation helps guide the eye and
give you insight **without your brain having to make a conscious effort**. The
fact that we are saving a bit on line count is also a bonus since this way you
can fit more of the file on your screen.

This last rule is not so rigid however since I am also a big fan of
[PEP8's 79-char limit](https://peps.python.org/pep-0008/#maximum-line-length)
because I like splitting my screen horizontally to have up to 4 files open at
the same time. So, I will use the heavier indentation when I can, but fall back
to the more conventional approach when the 79-char limit is about to be broken.
So it is possible to see something like this in my code:

```python
Base.\
    function1(arg1,
              arg2,
              arg3).\
    function2(
        very_long_arg1,
        very_long_arg2,
        very_long_arg2,
    )
```

My beliefs around the importance of indentation and on saving on line count
when possible also guide how I write docstrings:

```python
def a_function():
    """ Docstring line 1
        Docstring line 2
        Docstring line 3
        Docstring line 4
        Docstring line 5
    """

    code_line_1()
    code_line_2()
    code_line_3()
    code_line_4()
    code_line_5()
```
