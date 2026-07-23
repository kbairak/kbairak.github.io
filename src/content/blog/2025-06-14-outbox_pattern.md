---
title:  "Event-driven Architecture using the Outbox Pattern"
date: 2026-06-14T19:00:00+03:00

categories: programming python architecture
description: "Introduction"
---
## Introduction

I am not good at definitions, so I am going to steal some from [microservices.io](https://microservices.io):

**Event-driven Architecture**

> Use an event-driven, eventually consistent approach. Each service publishes an event whenever it update its data. Other service subscribe to events. When an event is received, a service updates its data.

**Outbox Pattern**

> The solution is for the service that sends the message to first store the message in the database as part of the transaction that updates the business entities. A separate process then sends the messages to the message broker.

As a side-project, I have implemented a python library called [outbox](https://github.com/kbairak/outbox). It uses [Async Python](https://docs.python.org/3/library/asyncio.html), [SQLAlchemy](https://docs.sqlalchemy.org) (with the [async extension](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)) and [aio-pika](https://docs.aio-pika.com) as a library to interact with [RabbitMQ](https://www.rabbitmq.com). Apart from that, it is made to be as standalone as possible; you should be able to use this with any async framework, although in my head it is going to be [FastAPI](https://fastapi.tiangolo.com).

This is my attempt at understanding Event-driven Architecture. We are going to write some pseudocode that implements a hypothetical service, explaining my thought process along the way.
