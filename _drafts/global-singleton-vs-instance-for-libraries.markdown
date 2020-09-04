---
layout: post
title:  "Global singleton objects vs class instances for libraries"
date:   2020-09-01 21:00:00 +0300
categories: programming python
---

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

Lately I have been working on an SDK for the
[Transifex API (v3)][transifex-api-v3]. It is an API based on the
[{json:api}][jsonapi] specification. So I decided that my process would be to:

1. Make an SDK Library (a library to help you build SDKs for APIs) targeted at
   {json:api} implementations
2. Use that library to build a Transifex API SDK

Following in the footsteps of libraries like Stripe's, I decided to go with the
global object approach:

```python
# jsonapi/globals.py

class _JsonApi:
    def __init__(self):
        self.host = None
        self.auth = None

    def setup(self, host, auth):
        self.host = host
        self.auth = auth

jsonapi = _JsonApi()

# jsonapi/__init__.py

from .globals import jsonapi

# __init__.py
from .jsonapi import jsonapi

setup = jsonapi.setup

# some_application.py
import os
from transifex import setup

setup("https://rest.api.transifex.com", os.environ['API_TOKEN'])
```

I really got into it. With {json:api} it makes sense to wrap classes around
"API resources" and get a lot of functionality from the discoverability of the
API responses. I even tried my hand at metaprogramming.

```diff
 # jsonapi/globals.py
 
 class _JsonApi:
     def __init__(self):
         self.host = None
         self.auth = None
         self.registry = {}
 
     def setup(self, host, auth):
         self.host = host
         self.auth = auth
 
+    def register(self, cls):
+        try:
+            self.registry[cls.TYPE] = cls
+        except AttributeError:
+            pass
 
 jsonapi = _JsonApi()
 
+# jsonapi/resources.py
+
+from .globals import jsonapi
+
+class ResourceMeta(type):
+    def __new__(cls, name, bases, dct):
+        result = super().__new__(cls, name, bases, dct)
+        jsonapi.register(result)
+        return result
+
+class Resource(metaclass=ResourceMeta):
+    # ...
 
 # jsonapi/__init__.py
 
 from .globals import jsonapi
+from .resources import Resource
 
 # __init__.py
-from .jsonapi import jsonapi
+from .jsonapi import jsonapi, Resource
 
 setup = jsonapi.setup
  
+class Organization(Resource):
+    TYPE = "organizations"
 
 # some_application.py
 import os
-from transifex import setup
+from transifex import setup, Organization
 
 setup("https://rest.api.transifex.com", os.environ['API_TOKEN'])

+organization = Organization.get("o:kb_org")
```

[stripe-docs]: https://github.com/stripe/stripe-python#usage
[transifex-api-v3]: https://transifex.github.io/openapi
[jsonapi]: https://jsonapi.org/
