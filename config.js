{
    "commands_NOTES":[{"name":"<description>","path":"<path to js shell>",
                  "notes1":"To enable test262, rename the relevant section to commands and modify the settings to match your setup",
                  "notes2":"You can specify name,path for multiple shells and running tests will run on each shell.",
                  "notes3":"Optional parameters are env, cacheTime, python.  env is a dict of key:value pair for environment variables to set",
                  "notes4":"python is path to python, cacheTime is the time in milliseconds how often output is displayed from the test262 script"}],
    "commands_OSX":[
                 {"name":"Spidermonkey","path":"/Users/dschaffe/workspace/mozilla-central/js/src/dist/bin/js","python":"python","cacheTime":15000},
                 {"name":"V8","path":"/Users/dschaffe/builds/v8/d8","cacheTime":15000},
                 {"name":"jsc","path":"/Users/dschaffe/workspace/jsc/WebKit/WebKitBuild/Release/jsc",
                  "cacheTime":15000,
                  "env":{"DYLD_FRAMEWORK_PATH":"/Users/dschaffe/workspace/jsc/WebKit/WebKitBuild/Release"}}
               ],
    "commands_WIN":[
                 {"name":"V8","path":"Z:/workspace/builds/spidermonkey/windows/js.exe","python":"C:/Python27/python"}
               ]
}