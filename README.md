# wle-cleaner

Experimental project file cleanup utility for Wonderland Engine.
**This tool is very experimental, use at your own risk. Always verify that the
cleaned project is OK after using the tool. Make sure to use version control**

Source code: https://github.com/playkostudios/wle-cleaner

NPM package: https://www.npmjs.com/package/@playkostudios/wle-cleaner

## Installing

```
npm install --save-dev @playkostudios/wle-cleaner
```

## Running

From the command line:
```
npm exec wle-cleaner -- my-project.wlp
```

From an NPM script (in `package.json`):
```
wle-cleaner my-project.wlp
```

If the project file is `my-project.wlp`, then the cleaned project will be saved
to `cleaned-my-project.wlp`.