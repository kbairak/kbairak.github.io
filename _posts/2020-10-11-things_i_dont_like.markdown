---
layout: post
title:  "Things I don't like"
date:   2020-10-11 18:00:00 +0300
categories: programming python
---

> If you add stuff to your code to make it simpler, it is possible you are
> misinterpreting your own intentions
>
> A Wise Man


## 1. Let's get DRY

```python
# constants.py
FOO_SERVICE_REDIS_KEY = "foo:{}"

# services.py
from .constants import FOO_SERVICE_REDIS_KEY

class FooService:
    def __init__(self, identifier, value):
        self.identifier = identifier
        self.value = value

    def save(self):
        redis.set(FOO_SERVICE_REDIS_KEY.format(self.identifier), self.value)
```

The idea here is that you are adding constants to reference templates used for
Redis keys.

Well, I don't know if you've heard, but in Python strings are immutable. So
they are already constants. This might seem like a technicality but it's not.
Seriously, there's **nothing** wrong with writing:

```python
redis.set("foo:{}".format(self.identifier), self.value)
```

> But I may want to change the key at some point. This way, I can do the change
> in only one place and every occurrence will be fixed. Otherwise I will have
> to `grep` for the string itself. DRY FTW!!!

Ugh, here we go:

1. If you are using the Redis key in multiple places, then you are probably
   already doing something very wrong.

2. You are going to **change** a Redis key, really? Where? In a production
   environment where you already have thousands of entries saved with the old
   key? Will you migrate all of them just to pick a more pleasant-sounding name
   for your key? And if you do, will `grep`ping for a string seriously be your
   biggest worry?

3. **If** you need to change the key, it will probably be a more significant
   change than fixing a typo. Most likely, you will want to add another
   parameter for formatting. This means that you will have to change both the
   constant **and** every invocation. Great DRYing there buddy!

And all of this is done in service of making the code harder to read. Why???


## 2. Gotta catch 'em all

```python
class SyncerError(Exception):
    pass

class Syncer:
    def save(self):
        try:
            response = requests.post(...)
            response.raise_for_status()
        except Exception:
            raise SyncerError("Something went wrong")
```

> Look! We are handling the exceptions. We aren't being irresponsible, letting
> all these ugly low-level exceptions bubble up to the higher-level parts of
> our code.

Let me ask you something: **Why is exceptions**? Some people back in the day
said: _"Hey C is cool but I want to design a new language, one that will have
exceptions"_. What feature do exceptions have that return values don't? The
answer: **They. bubble. up!**

In this example: `requests.post` or `response.raise_for_status` may raise an
exception for a multitude of reasons:

- The URL is not well-formed
- The `json` keyword argument we passed is not JSON-serializable
- The remote host is down
- The remote host timed out
- The remote host returned a 400 response because the data we sent is not
  right
- The remote host returned a 401 response because the `Authorization` header we
  sent did not authenticate
- The remote host returned a 403 response because we don't have permission to
  do what we wanted to do
- The remote host returned a 404 response because our URL didn't point anywhere
- The remote host returned a 409 because what we're trying to do has a conflict
  with the data that it already has
- The remote host freaked out and returned a 500 response
- and so on...

How are we supposed to handle a `SyncerError`?

```python
syncer = Syncer(...)
try:
    syncer.save()
except SyncerError as exc:
    print("(shrug) How the hell would I know what went wrong?")

    logger.exception(exc)
    logger.warning('Oh wait, I just logged "Something went wrong", didn\'t I?')
```

See what happened here? We **added code** in order to **destroy useful
information**!

The exceptions that the `requests` library raises are fine. They're just fine.
What's more, they were designed by people who spent a lot of time thinking
about them and who are probably way smarter than me or you. Just let them
bubble up to the higher levels of your codebase.

```python
class Syncer:
    def save(self):
        requests.post(...).raise_for_status()
```

> Hey, maybe the "higher level of the codebase" is the one that outputs a
> message to the end user. We don't want to tell the user exactly what went
> wrong, just tell them that **something** went wrong.

If only there was a way to match against _any_ exception...

```python
syncer = Syncer(...)
try:
    syncer.save()
except Exception as exc:
    print("Something went wrong (and you don't get to know what :p )")

    logger.exception(exc)
    logger.info("But we do get to know ;)")
```


## 3. More code equals better code, right?

```python
class Store:
    def __init__(self):
        self._data = {}

    def get(self, key):
        return self._data[key]

    def set(self, key, value):
        self._data[key] = value
```

You want to make a class. For objects that store values by key and retrieve
values by key. And you need to come up with an interface for these objects. I
wonder, could there be such an object type in the standard library?

Once upon a time, some **very smart** people spent **a lot of time** coming up
with such an object type. And they spent this time both on its
**implementation** and its **interface**. Just use a `dict`. It's **fine**.

Are you proud of your `get`/`set` interface? Well, `dict`s have: (deep breath)
`__getitem__`, `__setitem__`, `__delitem__`, `__iter__`, `__len__`,
`__contains__`, `keys`, `items`, `values`, `get`, `__eq__`, `__ne__`, `pop`,
`popitem`, `clear`, `update` and `setdefault`. Each and every one of them is
designed to be as useful and unambiguous as possible.

Why write more code to make things worse?

You want to add extra methods to your interface? Just inherit from `dict`!

While we're at it. Even if your `Store` objects don't simply keep their values
in a `self._data` dict but do something more complicated like using a Redis
database, disk storage etc, you should still inherit from
[`collections.abc.MutableMapping`][MutableMapping] and implement the
`__getitem__`, `__setitem__`, `__delitem__`, `__iter__` and `__len__` methods.
This way you get `dict`'s beautiful interface for your very custom
implementation.


## 4. Don't look at my privates

```python
class Foo:
    def __init__(self, field):
        self._field = field

    @property
    def field(self):
        return self._field

    @field.setter
    def field(self, value):
        self._field = value
```

Ok, this one is not so bad. `@property` _can_ be useful. However, this thing
takes a lot of space, makes the call stack more complicated and offers
**nothing**. I don't like it when people write code like this _on principle_.
As if accessing attributes on objects is _bad_ and we should use getters and
setters for everything.

For me, properties should limit themselves to:

- aggregations:

  ```python
  class Foo:
      def __init__(self, username=None, password=None, token=None):
          self.username = username
          self.password = password
          self.token = token

      @property
      def configured(self):
          return ((self.username is not None and self.password is not None) or
                  self.token is not None)
  ```

  and even then, a regular method called `.is_configured()` is just as good.

- lazy attributes:

  ```python
  class Foo:
      def __init__(self, url):
          self._url = url
          self._data = None

      @property
      def data(self):
          if self._data is None:
              self._data = requests.get(self._url).json()
          return self._data
  ```

- shortcuts:

  ```python
  class MyException(Exception):
      def __init__(self, message, status_code=None):
          super().__init__(message, status_code)

      @property
      def message(self):
          return self.args[0]

      @property
      def status_code(self):
          return self.args[1]
  ```

## 5. The word 'helper'

Instead of providing examples and/or arguments, I will simply list a snippet
from a [tensorflow tutorial][tensorflow-tutorial] that made me tear my eyes out
and give up on tensorflow for a few days a few years ago:

```python
# Helper
helper = tf.contrib.seq2seq.GreedyEmbeddingHelper(
    embedding_decoder,
    tf.fill([batch_size], tgt_sos_id), tgt_eos_id)

# Decoder
decoder = tf.contrib.seq2seq.BasicDecoder(
    decoder_cell, helper, encoder_state,
    output_layer=projection_layer)
# Dynamic decoding
outputs, _ = tf.contrib.seq2seq.dynamic_decode(
    decoder, maximum_iterations=maximum_iterations)
translations = outputs.sample_id
```

Spend a little time to think what your class/function is doing and incorporate
it into its name. If after thinking about it you can't come up with a better
name than "helper", then refactor it into more meaningful parts.

_(To tensorflow's credit, these modules are part of the `contrib` package. In
later versions things became way more sensible. They probably implemented these
as proofs-of-concept in order to make an implementation for a paper they wanted
published)_

### 5.1: The word 'executor'

I get it. Normally you would have to define a function with a hundred
arguments. So it might seem better to you if you do things like this:

```python
class FooExecutor:
    def __init__(self, arg1, arg2, arg3, arg4):
        self.arg1 = arg1
        self.arg2 = arg2
        self.arg3 = arg3
        self.arg4 = arg4

    def prepare(self, arg5, arg6, arg7):
        self.arg5 = arg5
        self.arg6 = arg6
        self.arg7 = arg7

    def execute(self, arg8, arg9, arg10):
        # ...

executor = FooExecutor(1, 2, 3, 4)
executor.prepare(5, 6, 7)
result = executor.do(8, 9, 10)
```

If this looks like the best thing you can do, then there's something wrong with
the overall design. You need to take a step back, take a deep breath and
refactor your code so that it makes more sense.

[MutableMapping]: https://docs.python.org/3/library/collections.abc.html#collections.abc.MutableMapping
[tensorflow-tutorial]: https://github.com/tensorflow/nmt#inference--how-to-generate-translations
