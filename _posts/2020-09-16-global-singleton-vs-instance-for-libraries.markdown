---
layout: post
title:  "Global singleton objects vs class instances for libraries"
date:   2020-09-16 21:00:00 +0300
categories: programming python
---

## Introduction

Lets assume we are working with an HTTP API SDK. Here is the first snippet from
[Stripe's documentation][stripe-docs]:

```python
import stripe
stripe.api_key = "sk_test_..."

# list customers
customers = stripe.Customer.list()
```

I would say this is pretty straightforward. There is a global object you
import, you edit its configuration for authentication purposes and then you are
able to access its attributes in order to interact with the API.

Lets try one from [PyGithub][pygithub-docs]:

```python
from github import Github

# using username and password
g = Github("user", "password")

# or using an access token
g = Github("access_token")

# Github Enterprise with custom hostname
g = Github(base_url="https://{hostname}/api/v3", login_or_token="access_token")

for repo in g.get_user().get_repos():
    # ...
```

So, now it seems we are creating custom instances that represent connections to
the GitHub API, which we configure during initialization. Again, pretty
straightforward, but why are there 2 approaches? Which is better?

## My solution

I have struggled with this dilemma in the past and my final choice is...
(drumroll) ... **both**.

Here's how it works:

```python
# package/core.py

class Foo:
    def __init__(self, **kwargs):
        self.host = "https://api.foo.com"
        self.username = None
        self.password = None
        self.api_token = None

        self.setup(**kwargs)

    def setup(self, host=None, username=None, password=None, api_token=None):
        if host is not None:
            self.host = host
        if username is not None:
            self.username = username
        if password is not None:
            self.password = password
        if api_token is not None:
            self.api_token = api_token
```

We set **default** values in `__init__`, override them in `setup` and we make
`__init__` conclude by delegating to `setup`.

What this does is make the following 2 snippets identical:

```python
kwargs = ...
f = Foo(**kwargs)
```

```python
kwargs = ...
f = Foo()
f.setup(**kwargs)
```

So lets assume we are writing an SDK for the _foo.com_ service. We will do:

```python
# foo/core.py
class Foo:
    # ...

# foo/__init__.py
from .core import Foo
foo = Foo()
```

Now, someone who wants to use the foo SDK can either:

- Use the global object:

  ```python
  # my_app.py
  from foo import foo
  foo.setup(username="...", password="...")
  foo.do_something()
  ```

- Or create a custom one (or more):
 
  ```python
  # my_app.py
  from foo import Foo
  foo1 = Foo(username="...", password="...")
  foo2 = Foo(api_token="...")
  foo1.do_something()
  foo2.do_something()
  ```

## Objections

> How do we ensure that an object is properly setup? Previously we could raise
> an exception if the user didn't supply enough arguments during
> initialization. Now we can't.

It's true. Since `__init__` must work **even without any arguments**, it's
possible to make an instance that is not properly configured. My first answer
to this is: _"Python is an
[easier-to-ask-for-forgiveness-than-permission][eafp] language"_. Or to put it
in other words: _"Hey buddy, I told you how to initialize the object in the
docs; it's not my fault you didn't supply all the arguments"_.

So, yeah, do nothing. Eventually the missing parameters will lead to an error.
That's fine.

However, you might not be entirely satisfied with this approach. There are ways
to make things better that don't sacrifice a lot of the elegance:

```python
class Foo:
    # __init__, setup, ...

    @property
    def configured(self):
        return ((self.username is not None and self.password is not None) or
                self.api_token is not None)
```

In this example, the foo object is considered "fully configured" if it either
has a username/password pair or an API token. The `configured` property lets
the user protect against using the object when it's not configured properly.

You can add to this:

```python
class Foo:
    # __init__, setup, configured

    def require_configured(self):
        if not self.configured:
            raise ValueError("Foo object is not properly configured")

    def do_something(self, ...):
        self.require_configured()
        # ...
```

The exception will be raised when you attempt to **use** the foo object, not
during initialization. But you can add a call to `require_configured` after
your initialization to get what you want. It only takes one extra line of code:

```python
from foo import foo
foo.setup(...)
foo.require_configured()  # <--
foo.do_something(...)
```

> What if the parameters have more complex types than simple strings? What if
> they are instances of classes that also need to be configured?

To explain what this question is about, lets describe it as an example: So,
lets say that the _foo.com_ service serves a lot of data and that we want our
SDK to cache that data so that it doesn't retrieve it every time. We also want
to provide a few cache implementations. Finally, lets assume that all
implementations receive the same parameter. We want to allow users to choose a
cache implementation to their liking and to be able to configure it with that
parameter. We also want users to be able to pass that parameter to the base
`foo` object's configuration to make things simple.

In short, we want **all** of these to be possible:

```python
from foo import foo
from foo.cache import MemoryCache, DiskCache

foo.setup(cache=MemoryCache())
foo.setup(cache=DiskCache())
foo.setup(cache=MemoryCache(ttl=30))
foo.setup(cache=DiskCache(ttl=30))
foo.setup(cache_ttl=30)
foo.setup(cache=MemoryCache(), cache_ttl=30)
foo.setup(cache=DiskCache(), cache_ttl=30)
```

The catch here is that we want the TTL option to be available either as a kwarg
to `foo`'s `setup` method or as a kwarg to the cache's initializer. We _may_
want this because it's possible that most users will use the default option for
the cache implementation and may want to simply change the TTL value.

How could we go about this? My answer would be:

1. Implement the cache classes like the `Foo` class:

   ```python
   # foo/cache.py
   class CacheBase:
       def __init__(self, **kwargs):
           self.ttl = 10
           self.setup(**kwargs)

       def setup(self, ttl=None):
           if ttl is not None:
               self.ttl = ttl

   class MemoryCache(CacheBase):
       # get, set, ...

   class DiskCache(CacheBase):
       # get, set, ...
   ```

2. At the end of `Foo.setup`, delegate to `cache.setup`:

   ```python
   # foo/core.py
   from .cache import MemoryCache
   class Foo:
       def __init__(self, **kwargs):
           self.cache = MemoryCache()  # Default value
           self.setup(**kwargs)

       def setup(self, cache=None, cache_ttl=None):
           if cache is not None:
               self.cache = cache
           self.cache.setup(ttl=cache_ttl)
   ```

_So, what if you do both, ie `foo.setup(DiskCache(ttl=20), cache_ttl=30)`?
Well, (hey buddy) I don't feel like I have to protect you from that. If you are
curious, you can figure it out from the code nevertheless._

This type of nesting lends itself to nice implementations of the `configured`
property we mentioned before:

```python
class Foo:
    # __init__, setup, ...
    @property
    def configured(self):
        return (self.username is not None and
                self.password is not None and
                self.cache.configured)
```

assuming the cache classes also have a property called `configured`.

## Conclusion

This is a bike-shedding problem. You can choose any solution and it will work
fine. While working on your SDK, there are going to be far more difficult
problems to solve. So, why did I write this?

Well, in terms of features, it offers the "hybrid" approach: You can offer the
simpler global-object approach for most cases, but if your user needs multiple
instances, there's nothing stopping them from doing so, without sacrificing any
of the elegance of the code. It also tackles the nested configuration issue
which can become complicated and lead to complicated code.

The main reason, however, is that it is a solid, one-size-fits-all solution. As
I said, this is a bike-shedding problem, which means that you can spend a lot
of time on it even though it is not a difficult problem to solve. Having a
solution ready can save a lot of frustration and lost time.


[stripe-docs]: https://github.com/stripe/stripe-python#usage
[pygithub-docs]: https://pygithub.readthedocs.io/en/latest/introduction.html
[eafp]: https://docs.python.org/3.4/glossary.html#term-eafp
