---
layout: post
title:  "The right kind of comment"
date:   2020-10-19 21:00:00 +0300
categories: programming python
---

I am going to steal a tiny bit of intellectual property from my company. In my
defence, it's something I wrote and it's not vital to our business model, just
some tedious low-level string processing.

Spend a few seconds to try to understand what this snippet does (no more than
that, I will explain what happens in a bit):

```python
from nltk.tokenize import sent_tokenize

def split_sentences(text):
    sentences = iter(sent_tokenize(text)))
    try:
        left = next(sentences)
    except StopIteration:
        return
    start = text.index(left)
    try:
        right = next(sentences)
    except StopIteration:
        yield text
        return
    end = text.index(right, start + len(left))
    yield text[0:end]
    while True:
        left = right
        start = end
        try:
            right = next(sentences)
        except StopIteration:
            yield text[start:]
            return
        end = text.index(right, start + len(left))
        yield text[start:end]
```

This piece of code is hard to understand, but not because it's especially
clever. Rather, it's doing some tedious things that are hard to follow.

Here is the docstring:

> Split text into sentences, preserving the spaces/newlines in-between.
>
> Sentences are resolved using `nltk.tokenize.sent_tokenize`. Because nltk
> strips the sentences of surrounding spaces, we have to restore them:
>
> - The first sentence will keep preceding and succeeding spaces.
> - The rest of the sentences will only keep the succeeding spaces.

Now, if we study the code again, we can start getting a better picture of
what's happening. However, it's still going to be hard to review and maintain
this without comments. What kind of comments are best for something like this?

Lets try this:

```python
# Find the starting position of the next sentence, starting from the end of the
# previous sentence
end = text.index(right, start + len(left))
```

This is good because it explains why we use `start + len(left)` as the second
argument to `.index`, but you will need such a comment for nearly every line
and it's going to become bloated, fast.

I believe there's a way to come up with comments that are both easier to read
and better explain what the code does. Here's what I would do (have done):

```python
def split_sentences(text):
    """ Split text into sentences, preserving the spaces/newlines in-between.

        Sentences are resolved using `nltk.tokenize.sent_tokenize`. Because
        nltk strips the sentences of surrounding spaces, we have to restore
        them:

        - The first sentence will keep preceding and succeeding spaces.
        - The rest of the sentences will only keep the succeeding spaces.
    """

    sentences = iter(sent_tokenize(text)))

    try:
        # '  one  two  three  four  '
        #    ^^^
        left = next(sentences)
    except StopIteration:
        return

    # '  one  two  three  four  '
    #  |-^
    start = text.index(left)
    try:
        # '  one  two  three  four  '
        #         ^^^
        right = next(sentences)
    except StopIteration:
        # '  one  '
        #  ^^^^^^^
        yield text
        return

    # '  one  two  three  four  '
    #       |-^
    end = text.index(right, start + len(left))

    # '  one  two  three  four  '
    #  ^^^^^^^
    yield text[0:end]

    while True:
        # '  ...  two  three  four  '
        #         ^^^
        left = right

        # '  ...  two  three  four  '
        #         ^
        start = end
        try:
            # '  ...  two  three  four  '
            #              ^^^^^
            right = next(sentences)
        except StopIteration:
            # '  ...  two  '
            # '       ^^^^^'
            yield text[start:]
            return
        # '  ...  two  three  four  '
        #            |-^
        end = text.index(right, start + len(left))
        # '  ...  two  three  four  '
        #         ^^^^^
        yield text[start:end]
```

I have used this type of comments frequently in my work and the feedback I have
gotten from coworkers has been positive. Plus, when I've had to work on my own
code weeks or months later, I have found them very helpful. I hope it serves as
inspiration to others.
