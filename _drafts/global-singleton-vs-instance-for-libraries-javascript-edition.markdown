---
layout: post
title:  "Global singleton objects vs class instances for libraries - Javascript edition"
date:   2020-09-17 01:00:00 +0300
categories: programming javascript
---

This is a rewrite of [this][python-version] but with all the snippets in
Javascript because, why not?

Lets assume we are working with an HTTP API SDK. Here is the first snippet from
[Stripe's documentation][stripe-docs]:

```javascript
import Stripe from 'stripe';
const stripe = new Stripe('sk_test_...');

(async () => {
  const customer = await stripe.customers.create({
    email: 'customer@example.com',
  });

  console.log(customer.id);
})();
```

I would say this is pretty straightforward. There is a global object you
import, you edit its configuration for authentication purposes and then you are
able to access its attributes in order to interact with the API.

Lets try one from [Github's javascript SDK][octokit-rest-js-docs]:

```javascript
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({
  auth: "secret123",
  baseUrl: 'https://api.github.com',
  // ...
})
(async () => {
  const { data: pullRequest } = await octokit.pulls.get({
    owner: "octokit",
    repo: "rest.js",
    pull_number: 123,
  });
)();
```

So, now it seems we are creating custom instances that represent connections to
the GitHub API, which we configure during initialization. Again, pretty
straightforward, but why are there 2 approaches? Which is better?

I have struggled with this dilemma in the past and my final choice is...
(drumroll) ... **both**.

Here's how it works:

```javascript
// package/core.js

class Foo {
  constructor(props) {
    this.host = 'https://api.foo.com';
    this.username = null;
    this.password = null;
    this.apiToken = null;

    this.setup(props);
  }

  setup({ host, username, password, apiToken }) {
    if (host) { this.host = host; }
    if (username) { this.username = username; }
    if (password) { this.password = password; }
    if (apiToken) { this.apiToken = apiToken; }
  }
}
```

We set **default** values in the constructor, override them in `setup` and we
make the constructor conclude by delegating to `setup`.

What this does is make the following 2 snippets identical:

```javascript
const props = ...;
let f = new Foo(props);
```

```javascript
const props = ...;
let f = new Foo();
f.setup(props);
```

So lets assume we are writing an SDK for the _foo.com_ service. We will do:

```javascript
// foo/core.js
export default class Foo { ... }

// foo/index.js
import Foo from './core';

let foo = new Foo();

export Foo;
export foo;
```

Now, someone who wants to use the foo SDK can either:

- Use the global object:

  ```javascript
  // my_app.js
  import { foo } from 'foo';
  foo.setup({ username: '...', password: '...' })
  foo.do_something();
  ```

- Or create a custom one (or more):
 
  ```javascript
  // my_app.js
  import { Foo } from 'foo';
  let foo1 = Foo({ username: '...', password: '...' });
  let foo2 = Foo({ apiToken: '...' });
  foo1.doSomething();
  foo2.doSomething();
  ```

## Objections

> How do we ensure that an object is properly setup? Previously we could throw
> an exception if the user didn't supply enough arguments during
> initialization. Now we can't.

It's true. Since the constructor must work **even without any arguments**, it's
possible to make an instance that is not properly configured. My answer to this
is would be: _"Hey buddy, I told you how to initialize the object in the docs;
it's not my fault you didn't supply all the arguments"_.

So, yeah, do nothing. Eventually the missing parameters will lead to an error.
That's fine.

However, you might not be entirely satisfied with this approach. There are ways
to make things better that don't sacrifice a lot of the elegance:

```javascript
class Foo {
  // constructor, setup, ...

  isConfigured() {
    return (this.username && this.password) || this.apiToken;
  }
}
```

In this example, the foo object is considered "fully configured" if it either
has a username/password pair or an API token. The `configured` property lets
the user protect against using it when it's not configured properly.

You can add to this:

```javascript
class Foo {
  // constructor, setup, isConfigured

  requireConfigured() {
    if (! self.isConfigured()) {
      throw 'Foo object is not properly configured';
    }
  }

  doSomething(...) {
    this.requireConfigured();
    // ...
  }
}
```

The exception will be raised when you attempt to **use** the foo object, not
during initialization. But you can add a call to `requireConfigured` after
your initialization to get what you want. It only takes one extra line of code:

```javascript
import foo from 'foo';
foo.setup({ ... });
foo.requireConfigured();  // <--
foo.doSomething(...);
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
`foo` object's configuration to make things simple. In short, we want **all**
of these to be possible:

```javascript
import { foo } from 'foo';
import { MemoryCache, DiskCache } from 'foo/cache';

foo.setup({ cache: new MemoryCache() });
foo.setup({ cache: new DiskCache() });
foo.setup({ cache: new MemoryCache({ ttl: 30 }) });
foo.setup({ cache: new DiskCache({ ttl: 30 }) });
foo.setup({ cacheTtl: 30 });
foo.setup({ cache: new MemoryCache(), cacheTtl: 30 });
foo.setup({ cache: new DiskCache(), cacheTtl: 30 });
```

The catch here is that we want the TTL option to be available either as a
property to `foo`'s `setup` method or as a property to the cache's initializer.
We _may_ want this because it's possible that most users will use the default
option for the cache implementation and may want to simply change the TTL
value.

How could we go about this? My answer would be:

1. Implement the cache classes like the `Foo` class:

   ```javascript
   // foo/cache.js
   class CacheBase {
     constructor(props) {
       this.ttl = 10;
       this.setup(props);
     }

     setup({ ttl }) {
       if ( ttl ) { this.ttl = ttl; }
     }
   }

   class MemoryCache extends CacheBase {
     // get, set, ...
   }

   class DiskCache extends CacheBase {
     // get, set, ...
   }
   ```

2. At the end of `Foo.setup`, delegate to `cache.setup`:

   ```javascript
   // foo/core.py
   import { MemoryCache } from './cache';
   class Foo {
     constructor(props) {
       this.cache = new MemoryCache();  // Default value
       this.setup(props);
     }

     setup({ cache, cacheTtl }) {
       if ( cache ) { this.cache = cache; }
       this.cache.setup({ ttl: cacheTtl });
     }
   }
   ```

_So, what if you do both, ie
`foo.setup({ new DiskCache({ ttl: 20 }), cacheTtl: 30 })`? Well, (hey buddy) I
don't feel like I have to protect you from that. If you are curious, you can
figure it out from the code nevertheless._

This type of nesting lends itself to nice implementations of the `isConfigured`
property we mentioned before:

```javascript
class Foo {
  // constructor, setup, ...
  isConfigured() {
    return this.username && this.password && this.cache.isConfigured();
  }
}
```

assuming the cache classes also have a property called `isConfigured`.

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


[python-version]: {% link _posts/2020-09-16-global-singleton-vs-instance-for-libraries.markdown %}
[stripe-docs]: https://github.com/stripe/stripe-node
[octokit-rest-js-docs]: https://octokit.github.io/rest.js/v18
[eafp]: https://docs.python.org/3.4/glossary.html#term-eafp
