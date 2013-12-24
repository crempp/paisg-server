TODO:
* Fork the compute master into it's own process. The goal is to reduce the
  number of items in the event loop queue so that the accuracy of setTimeout
  is as high as possible
