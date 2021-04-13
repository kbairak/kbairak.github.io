---
layout: post
title:  "Extending my laptop battery's lifetime"
date:   2021-02-21 21:00:00 +0300
categories: operating-systems laptop
---

Lately I had to replace my laptop battery because it got swollen. After doing
so, I looked into how to better maintain my battery and maximize its lifetime.
My research revealed the following:

It turns out that you need to minimize the number of times you **start**
charging your battery. If you have your laptop mostly plugged in (which I
assume most of us do), then every time the battery drops below 100%, it starts
charging it. So, you initiate "charging cycles" almost every day when it's not
really needed. It is better to let it drop up to a point before starting to
charge it.

So, I've set a 50-80% margin. This means that my battery will not start
charging until it drops to 50%, and even then it will charge up to 80%. Since I
am mostly working with the laptop plugged in, this will take weeks to happen.
When plugged in, the battery discharges the same way as if it wasn't connected
to the laptop at all. The laptop only relies on the battery when I change
rooms, and even that usually happens when it's suspended. I've had my battery
for almost a month and today is the first time it started charging. 50% battery
is more than enough for me to change rooms which is realistically the only
reason I would need to have my laptop on battery power.

The only danger is that at some point I will urgently need to work outdoors
when my battery is close to 50%. If I know I will have to rely on the battery
in advance, I have a script to reset charging to normal mode.

During my research I found that Dell has some utilities for managing the
charging mode, but it's mostly for Windows. I assume that Macs will have
something similar. If you are on a Dell laptop on Linux, you are stuck with a
command-line program called `cctk`. It should be easy to install on an Ubuntu
distro (I wouldn't know). Assuming you have `cctk` installed, the commands you
need to run are:

- `sudo cctk --PrimaryBattChargeCfg=Custom:50-80` to set the custom mode
- `sudo cctk --PrimaryBattChargeCfg=Adaptive` to set the mode it had originally

[https://www.dell.com/support/kbdoc/en-us/000178000/dell-command-configure](https://www.dell.com/support/kbdoc/en-us/000178000/dell-command-configure)
