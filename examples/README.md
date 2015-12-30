# netconf-client example

This is how i like to upload configuration to my devices. By splitting out the data and template it's easy to reuse the existing script for multiple purposes.

```shell
cat data.json | ./render.js template.hb | ./netconf-client.js
```

or if configuration is done by set commands directly instead of template based.

```shell
cat set-data.txt | ./netconf-client.js
```
