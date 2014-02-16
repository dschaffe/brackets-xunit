/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 * brackets-xunit - a brackets extension to run various unit test frameworks
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global brackets, define, $, window, Mustache */
define(function (require, exports, module) {
    'use strict';
    
    var AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        Menus               = brackets.getModule("command/Menus"),
        FileSystem          = brackets.getModule("filesystem/FileSystem"),
        LanguageManager     = brackets.getModule("language/LanguageManager"),
        
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        qunitRunner         = require("main_qunit"),
        jasmineRunner       = require("main_jasmine"),
        yuiRunner           = require("main_yui"),
        MyStatusBar         = require("MyStatusBar");

    var moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
        templateFile        = FileSystem.getFileForPath(moduledir + '/templates/jasmine/jasmineNodeReportTemplate.html'),
        reportJasNodeFile   = FileSystem.getFileForPath(moduledir + '/node/reports/jasmineReport.html'),
        commands            = [],
        YUITEST_CMD         = "yuitest_cmd",
        JASMINETEST_CMD     = "jasminetest_cmd",
        QUNITTEST_CMD       = "qunit_cmd",
        SCRIPT_CMD          = "script_cmd",
        NODETEST_CMD        = "nodetest_cmd",
        GENERATE_JASMINE_CMD = "generate_jasmine_cmd",
        GENERATE_QUNIT_CMD  = "generate_qunit_cmd",
        GENERATE_YUI_CMD    = "generate_yui_cmd",
        VIEWHTML_CMD        = "viewhtml_cmd",
        projectMenu         = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        workingsetMenu      = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_MENU),
        nodeConnection      = new NodeConnection(),
        _windows            = {},
        enableHtml          = false;
   
    
    /* display a modal dialog
     * title: string  
     * message: string
     */
    function showError(title, message) {
        Dialogs.showModalDialog(
            Dialogs.DIALOG_ID_ERROR,
            title,
            message
        );
    }
 
    /* finds the brackets-xunit: includes= strings contained in a test
     * parameters: contents dir
     *    contents = string of the entire test
     *    dirPath = the base directory
     * returns: string of <script src="dir+path"/>
     */
    function parseIncludes(contents, dirPath, cache) {
        var includes = '';
        if (contents && contents.match(/brackets-xunit:\s*includes=/)) {
            var includestr = contents.match(/brackets-xunit:\s*includes=[A-Za-z0-9,\._\-\/\*]*/)[0];
            includestr = includestr.substring(includestr.indexOf('=') + 1);
            
            var includedata = includestr.split(',');
            var i;
            for (i = 0; i < includedata.length; i++) {
                var includeFile = includedata[i],
                    codeCoverage = '',
                    cacheBuster = cache ? '?u=' + cache : '';
                if (includeFile[includeFile.length - 1] === "*") {
                    includeFile = includeFile.substring(0, includeFile.length - 1);
                    codeCoverage = ' data-cover';
                    //cacheBuster = '';
                }
                includes = includes + '<script src="' + dirPath + includeFile + cacheBuster + '"' + codeCoverage + '></script>\n';
            }
        }
        return includes;
    }

    // chain: connects multiple function calls together,  the functions must return Deferred objects
    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        if (functions.length > 0) {
            var firstFunction = functions.shift();
            var firstPromise = firstFunction.call();
            firstPromise.done(function () {
                chain.apply(null, functions);
            });
        }
    }
    // Execute YUI test
    function runYUI() {
        yuiRunner.run();
    }
 
    // Execute Jasmine test
    function runJasmine() {
        jasmineRunner.run();
       
    }
    
    // Run jasmine-node test, call to node server
    //    when finishes the jasmine.update event is called
    function runJasmineNode() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var path = entry.fullPath;
        nodeConnection.domains.jasmine.runTest(path)
            .fail(function (err) {
                console.log("[brackets-jasmine] error running file: " + entry.fullPath + " message: " + err.toString());
                Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "Jasmine Error",
                    "The test file contained an error: " + err.toString()
                );
            });
    }

    // Runs a QUnit test
    function runQUnit() {
        qunitRunner.run();
    }
    
    // opens an html file in a new window
    function viewHtml() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var path = entry.fullPath;
        var w = window.open(path);
        w.focus();
    }
    
    // Run a current file as a shell script using node process spawn
    // results are returned as the script runs from process.stdout, process.stderr
    // when the script finishes the exit code is returned from the event process.exit
    function runScript() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var path = entry.fullPath,
            args = [],
            text = DocumentManager.getCurrentDocument().getText(),
            argsmatch = text.match(/brackets-xunit:\s*args=\S+/),
            argsstr = '',
            argsout = '';
            
        if (argsmatch !== null && argsmatch.length > 0) {
            argsstr = argsmatch[0].substring(argsmatch[0].indexOf("=") + 1);
            args = argsstr.split(',');
            argsout = '';
            var i;
            for (i = 0; i < args.length; i++) {
                argsout = argsout + args[i] + " ";
            }
        }
        nodeConnection.domains.process.spawnSession({executable: path, args: args, cacheTime: 100}).done(function (status) {
            var template = require("text!templates/process.html"),
                html = Mustache.render(template, { path: path, title: "script - " + path, args: argsout}),
                newWindow = window.open("about:blank", null, "width=600,height=200");
            newWindow.document.write(html);
            newWindow.document.getElementById("exitcode").innerHTML = "running with pid " + status.pid;
            newWindow.focus();
            _windows[status.pid] = {window: newWindow, startTime: new Date(), type: "script"};
        });
    }

    // parses the current javascript document
    // an array containing function name and parameters are returned
    // returns: array of objects { name, params } 
    //          params is an array of strings containing parameter names
    function parseCurrentDocument() {
        var text = DocumentManager.getCurrentDocument().getText();
        var acorn = require('thirdparty/acorn/acorn_loose');
        var walk = require('thirdparty/acorn/walk');
        var ast = acorn.parse_dammit(text);
        var i, functions = [], fparams;
        walk.simple(ast, {
            FunctionDeclaration: function (node) {
                fparams = [];
                for (i = 0; i < node.params.length; i++) {
                    fparams.push(node.params[i].name);
                }
                functions.push({name: node.id.name, params: fparams});
            }
        });
        return functions;
    }
    // createNewFile: for generated tests created a new file in brackets
    // the file is added to the project (left panel)
    function createNewFile(fullpath, contents, testExt) {
        function _getUntitledFileSuggestion(dirPath, baseFileName, fileExt, isFolder) {
            var result = new $.Deferred();
            result.progress(function attemptNewName(suggestedName, nextIndexToUse) {
                if (nextIndexToUse > 99) {
                    //we've tried this enough
                    result.reject();
                    return;
                }

                
                
                //check this name
                var callback = function (error) {
                    if (error) {
                        //most likely error is FNF, user is better equiped to handle the rest
                        result.resolve(suggestedName);
                    } else {
                        //file exists, notify to the next progress
                        result.notify(baseFileName + "-" + nextIndexToUse + fileExt, nextIndexToUse + 1);
                    }
                };
            
                if (isFolder) {
                    FileSystem.resolve(
                        suggestedName,
                        callback
                    );
                } else {
                    FileSystem.resolve(
                        suggestedName,
                        callback
                    );
                }
            });

            //kick it off
            result.notify(baseFileName + fileExt, 1);

            return result.promise();
        }
        var basedir = fullpath.substring(0, fullpath.lastIndexOf("/")),
            name = fullpath.substring(fullpath.lastIndexOf("/") + 1),
            testname = name.substring(0, name.lastIndexOf('.js')) + testExt;
        var deferred = _getUntitledFileSuggestion(basedir, testname, ".js", false);
        var createWithSuggestedName = function (suggestedName) {
            var result = ProjectManager.createNewItem(basedir, suggestedName, true, false);
            result.done(function (entry) {
                DocumentManager.getDocumentForPath(entry.fullPath).done(function (doc) {
                    doc.setText(contents);
                });
            });
        };

        deferred.done(createWithSuggestedName);
        return deferred;
    }
    
    // returns a global object per test type to pass jslint
    function generateGlobalDeclaration(type, test, functions) {
        var fnames = '', i;
        switch (type) {
        case "jasmine":
            test += '/*global describe, it, expect';
            break;
        case "qunit":
            test += '/*global test, ok';
            break;
        case "yui":
            test += '/*global YUI';
            break;
        }

        for (i = 0; i < functions.length; i++) {
            fnames += ", " + functions[i].name;
        }
        test += fnames + " */\n";
        return test;
    }

    function generateJasmineTest() {
        var functions = parseCurrentDocument(),
            fullpath = DocumentManager.getCurrentDocument().file.fullPath,
            filename = DocumentManager.getCurrentDocument().file.name,
            contents = DocumentManager.getCurrentDocument().getText(),
            userequire = contents.match(/define\w*\(/),
            i,
            j,
            fparamstr;
        
        if (functions.length === 0) {
            showError("Generate Jasmine Test", "Warning: The file " + filename + " does not have any methods to test.");
            return;
        }
        var test = '// generated by xUnit ' + new Date() + '\n' +
                   '// jasmine unit test for ' + filename + '\n';
        if (userequire) {
            test = generateGlobalDeclaration("jasmine", test, functions);
            test += 'define(function (require, exports, module) {\n' +
                    "    'use strict';\n" +
                    "    var testapi = require('./" + filename + "');\n";
            for (i = 0; i < functions.length; i++) {
                fparamstr = '';
                for (j = 0; j < functions[i].params.length; j++) {
                    if (j > 0) {
                        fparamstr += ", ";
                    }
                    fparamstr += functions[i].params[j];
                }
                test += '    describe' + '("test ' + functions[i].name + '(' + fparamstr + ')", function () {\n';
                if (fparamstr !== '') {
                    test += '        var ' + fparamstr + ';\n';
                }
                test += '        it("' + functions[i].name + '(' + fparamstr + ') === ?", function () {\n' +
                        '            expect(testapi.' + functions[i].name + '(' + fparamstr + ')).toEqual("?");\n' +
                        '        });\n' +
                        '    });\n';
            }
            test += '});\n';
        } else {
            test += '// brackets-xunit: includes=' + filename + '\n';
            test = generateGlobalDeclaration("jasmine", test, functions);
            for (i = 0; i < functions.length; i++) {
                fparamstr = '';
                for (j = 0; j < functions[i].params.length; j++) {
                    if (j > 0) {
                        fparamstr += ", ";
                    }
                    fparamstr += functions[i].params[j];
                }
                test += 'describe' + '("test ' + functions[i].name + '(' + fparamstr + ')", function () {\n';
                test += '    "use strict";\n';
                if (fparamstr !== '') {
                    test += '    var ' + fparamstr + ';\n';
                }
                test += '    it("' + functions[i].name + '(' + fparamstr + ') === ?", function () {\n' +
                        '        expect(' + functions[i].name + '(' + fparamstr + ')).toEqual("?");\n' +
                        '    });\n' +
                        '});\n';
            }
        }
        createNewFile(fullpath, test, ".spec");
    }
    
    function generateQunitTest() {
        var functions = parseCurrentDocument(),
            filename = DocumentManager.getCurrentDocument().file.name,
            i,
            j,
            fparamstr,
            fullpath = DocumentManager.getCurrentDocument().file.fullPath;
        
        if (functions.length === 0) {
            showError("Generate Qunit Test", "Warning: The file " + filename + " does not have any methods to test.");
            return;
        }
        var test = '// generated by xUnit ' + new Date() + '\n' +
                   '// qunit test for ' + filename + '\n' +
                   '// brackets-xunit:' + ' qunit\n' +
                   '// brackets-xunit: includes=' + filename + '\n';
        test = generateGlobalDeclaration("qunit", test, functions);
        for (i = 0; i < functions.length; i++) {
            fparamstr = '';
            for (j = 0; j < functions[i].params.length; j++) {
                if (j > 0) {
                    fparamstr += ", ";
                }
                fparamstr += functions[i].params[j];
            }
            test += 'test' + '("test ' + functions[i].name + '(' + fparamstr + ')", function () {\n';
            if (fparamstr !== '') {
                test += '    "use strict";\n';
                test += '    var ' + fparamstr + ';\n';
            }
            test += '    ok' + '(' + functions[i].name + '(' + fparamstr + ') === "?", "' + functions[i].name + '(' + fparamstr + ') === ?");\n';
            test += '});\n';
        }
        createNewFile(fullpath, test, ".qunit");
    }

    function generateYuiTest() {
        var functions = parseCurrentDocument(),
            filename = DocumentManager.getCurrentDocument().file.name,
            i,
            j,
            fparamstr,
            fullpath = DocumentManager.getCurrentDocument().file.fullPath;
        
        if (functions.length === 0) {
            showError("Generate YUI Test", "Warning: The file " + filename + " does not have any methods to test.");
            return;
        }
        var test = '// generated by xUnit ' + new Date() + '\n' +
                   '// YUI test for ' + filename + '\n' +
                   '// brackets-xunit:' + ' yui\n' +
                   '// brackets-xunit: includes=' + filename + '\n\n';
        test = generateGlobalDeclaration("yui", test, functions);
        test += "YUI({ logInclude: {TestRunner: true }}).use('test', 'test-console', function (Y) {\n" +
                   "    'use strict';\n" +
                   '    var testCase = new Y.Test.Case({\n' +
                   '        name: " test ' + filename + ' functions",\n';
                    
        
        for (i = 0; i < functions.length; i++) {
            fparamstr = '';
            for (j = 0; j < functions[i].params.length; j++) {
                if (j > 0) {
                    fparamstr += ", ";
                }
                fparamstr += functions[i].params[j];
            }
            if (i > 0) {
                test += ',\n';
            }
            test += '        test' + functions[i].name + ': function () {\n';
            if (fparamstr !== '') {
                test += '            var ' + fparamstr + ';\n';
            }
            test += '            Y.assert(' + functions[i].name + '(' + fparamstr + ') === "?",  "test ' + functions[i].name + '(' + fparamstr + ') === ?");\n' +
                    '        }';
        }
        test += '\n    });\n' +
                '    Y.Test.Runner.add(testCase);\n' +
                '    (new Y.Test.Console({\n' +
                '        newestOnTop: false\n' +
                "    })).render('#log');\n" +
                "    Y.Test.Runner" + ".run();\n" +
                "});\n";
        createNewFile(fullpath, test, ".yui");
    }

    // converts time in ms to a more readable string format
    // e.g. 1h 10m 30.2s
    function formatTime(ms) {
        var result = "",
            secs = ms / 1000;
        if (secs >= 60 * 60 * 24 * 365) {
            result = (Math.floor(secs / (60 * 60 * 24 * 365))) + "y ";
            secs = secs % (60 * 60 * 24 * 365);
        }
        if (secs >= 60 * 60 * 24) {
            result = (Math.floor(secs / (60 * 60 * 24))) + "d ";
            secs = secs % (60 * 60 * 24);
        }
        if (secs >= 60 * 60) {
            result = result + (Math.floor(secs / (60 * 60))) + "h ";
            secs = secs % (60 * 60);
        }
        if (secs >= 60) {
            result = result + (Math.floor(secs / 60)) + "m ";
            secs = secs % 60;
        }
        if (result === "" || secs > 0) {
            result = result + Math.round(10 * secs) / 10 + "s";
        }
        if (result[result.length - 1] === " ") {
            result = result.substring(0, result.length - 1);
        }
        return result;
    }

    
    // reads config.js to determine if brackets-xunit should be disabled for the current project     
    function readConfig() {
        var result = new $.Deferred();
        var root = ProjectManager.getProjectRoot(),
            configFile = FileSystem.getFileForPath(root.fullPath + "config.js");
        FileUtils.readAsText(configFile).done(function (text) {
            try {
                var config = JSON.parse(text);
                if (config.hasOwnProperty('brackets-xunit') && config['brackets-xunit'] === 'disable') {
                    result.reject('disabled');
                }
            } catch (e) {
                console.log("[brackets-xunit] reading " + root.fullPath + "config.js Error " + e);
            } finally {
                return result.resolve('ok');
            }
        }).fail(function () {
            return result.resolve('ok');
        });
        return result.promise();
    }
    
    // determine if a file is a known test type
    // first look for brackets-xunit: [type], takes precedence
    // next look for distinguishing clues in the file:
    //   YUI: 'YUI(' and 'Test.runner.test'
    //   jasmine: 'describe' and 'it'
    //   QUnit: 'test()' and 'it()'
    function determineFileType(fileEntry, text) {
        if (text && text.match(/^#!/) !== null) {
            return "script";
        } else if (text && fileEntry && fileEntry.fullPath && fileEntry.fullPath.match(/\.js$/)) {
            if (text.match(/brackets-xunit:\s*yui/i) !== null) {
                return "yui";
            } else if (text.match(/define\(/i) && text.match(/describe\s*\(/)) {
                return "jasmine";
            } else if (text.match(/brackets-xunit:\s*jasmine-node/i)) {
                return "node";
            } else if (text.match(/brackets-xunit:\s*jasmine/i) !== null) {
                return "jasmine";
            } else if (text.match(/brackets-xunit:\s*qunit/i) !== null) {
                return "qunit";
            } else if (text.match(/describe\s*\(/) && text.match(/it\s*\(/)) {
                return "jasmine";
            } else if (text.match(/YUI\s*\(/) && text.match(/Test\.Runner\.run\s*\(/)) {
                return "yui";
            } else if (text.match(/test\s*\(/) && text.match(/ok\s*\(/)) {
                return "qunit";
            } else {
                return "generate";
            }
        } else if (fileEntry && fileEntry.fullPath && fileEntry.fullPath.match(/\.html$/)) {
            return "html";
        } else {
            return "unknown";
        }
    }
    /*
     * cleanMenu - removes all brackets-xunit menu items from a menu
     * parameters: menu - the WorkingSetMenu or the ProjectMenu
     */
    function cleanMenu(menu) {
        var i;
        for (i = 0; i < commands.length; i++) {
            menu.removeMenuItem(commands[i]);
        }
    }
    /*
     * checkFileTypes - adds a menuitem to a menu if the current file matches a known type
     * parameters: menu - the context menu or working files menu
     *             entry - the current file entry object containing the file name
     *             text - the contents of the current file
     */
    function checkFileTypes(menu, entry, text) {
        if (entry === null) {
            return "unknown";
        }
        var type = determineFileType(entry, text);
        if (type === "yui") {
            menu.addMenuItem(YUITEST_CMD, "", Menus.LAST);
        } else if (type === "jasmine") {
            menu.addMenuItem(JASMINETEST_CMD, "", Menus.LAST);
        } else if (type === "qunit") {
            menu.addMenuItem(QUNITTEST_CMD, "", Menus.LAST);
        } else if (type === "script") {
            menu.addMenuItem(SCRIPT_CMD, "", Menus.LAST);
        } else if (type === "node") {
            menu.addMenuItem(NODETEST_CMD, "", Menus.LAST);
        } else if (enableHtml && type === "html") {
            menu.addMenuItem(VIEWHTML_CMD, "", Menus.LAST);
        }
        if (type === "generate") {
            menu.addMenuItem(GENERATE_JASMINE_CMD, "", Menus.LAST);
            menu.addMenuItem(GENERATE_QUNIT_CMD, "", Menus.LAST);
            menu.addMenuItem(GENERATE_YUI_CMD, "", Menus.LAST);
        }
    }
    // setup, connects to the node server loads node/JasmineDomain and node/ProcessDomain
    AppInit.appReady(function () {
        
         /*Globals for passing objects from run windows*/
        window.reportComplete = function (result) {
            if (result.status === "failed") {
                MyStatusBar.statusFailed(result.message);
                MyStatusBar.toggleCollapsed(false);
            } else {
                MyStatusBar.statusPassed(result.message);
            }
        };
        
        window.reportUpdate = function (result) {
            console.log("update", result);
            MyStatusBar.statusRunning(result.message);
        };
        
        window.coverageComplete = function (result) {
            MyStatusBar.statusCoverage(result.message);
        };
        
        
        function runTestsOnSaveOrChange(document) {
                
                
            var language = document ? LanguageManager.getLanguageForPath(document.file.fullPath) : "";
            if (language && language.getId() === "javascript") {
                
                var selectedEntry = document.file,
                    text = document.getText(),
                    type;
                readConfig().done(function () {
                    
                    type = determineFileType(selectedEntry, text);
                    if (type === "yui") {
                        $("#status-language").text("Javascript+YUI");
                        runYUI();
                    } else if (type === "jasmine") {
                        $("#status-language").text("Javascript+Jasmine");
                        runJasmine();
                    } else if (type === "qunit") {
                        $("#status-language").text("Javascript+QUnit");
                        runQUnit();
                    }
                    
                });
            }
        }
        
        $(DocumentManager)
            .on("documentSaved.xunit", function (e, d) {
                runTestsOnSaveOrChange(d);
            });
       
    
        $(DocumentManager)
            .on("currentDocumentChange", function () {
                runTestsOnSaveOrChange(DocumentManager.getCurrentDocument());
            });
        
        MyStatusBar.initializePanel();
        
        nodeConnection = new NodeConnection();
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            connectionPromise.fail(function () {
                console.error("[brackets-xunit] failed to connect to node");
            });
            return connectionPromise;
        }

        function loadJasmineDomain() {
            var path = ExtensionUtils.getModulePath(module, "node/JasmineDomain");
            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function () {
                console.log("[brackets-xunit] failed to load jasmine domain");
            });
            return loadPromise;
        }

        $(nodeConnection).on("jasmine.update", function (evt, jsondata) {
            if (jsondata.length > 5 && jsondata.substring(0, 6) === 'Error:') {
                Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "Jasmine Node Error",
                    jsondata.substring(7)
                );
            } else {
                FileUtils.readAsText(templateFile).done(function (text) {

                    jsondata = jsondata.replace(/'/g, "");
                    
                    var jdata = JSON.parse(jsondata);
                    var totaltime = 0;
                    var i;
                    for (i = 0; i < jdata.length; i++) {
                        totaltime = totaltime + parseFloat(jdata[i].time);
                    }
                    var html = Mustache.render(text, {jsondata: jsondata, time: totaltime});
                    FileUtils.writeText(reportJasNodeFile, html).done(function () {
                        window.open(reportJasNodeFile.fullPath);
                    });
                });
            }
        });

        function loadProcessDomain() {
            var path = ExtensionUtils.getModulePath(module, "node/ProcessDomain");
            var loadPromise = nodeConnection.loadDomains([path], true);
            loadPromise.fail(function () {
                console.log("[brackets-xunit] failed to load process domain");
            });
            return loadPromise;
        }

            
        $(nodeConnection).on("process.stdout", function (event, result) {
            var pid = result.pid,
                data = result.data;
            data = data.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');
            if (_windows.hasOwnProperty(pid) === false) {
                showError("Process Error", "there is no window with pid=" + pid);
            } else {
                var _window = _windows[pid].window,
                    _time = _windows[pid].startTime,
                    elapsed = new Date() - _time;
                _window.document.getElementById("stdout-section").style.display = "block";
                _window.document.getElementById("stdout").innerHTML += data;
                _window.document.getElementById("time").innerHTML = formatTime(elapsed);
            }
        });
                
        $(nodeConnection).on("process.stderr", function (event, result) {
            var pid = result.pid,
                data = result.data;
            data = data.replace(/\r\n/g, '<br>').replace(/\n/g, '<br>');
            if (_windows.hasOwnProperty(pid) === false) {
                showError("Process Error", "there is no window with pid=" + pid);
            } else {
                var _window = _windows[pid].window,
                    _time = _windows[pid].startTime,
                    elapsed = new Date() - _time;
                _window.document.getElementById("stderr-section").style.display = "block";
                _window.document.getElementById("stderr").innerHTML += data;
                _window.document.getElementById("time").innerHTML = formatTime(elapsed);
            }
        });

        $(nodeConnection).on("process.exit", function (event, result) {
            var pid = result.pid,
                data = result.data;
            data = data.replace(/\n/g, '<br>');
            if (_windows.hasOwnProperty(pid) === false) {
                showError("Process Error", "there is no window with pid=" + pid);
            } else {
                var _window = _windows[pid].window,
                    _time = _windows[pid].startTime,
                    elapsed = new Date() - _time,
                    code = result.exitcode;
                _window.document.getElementById("stdout-section").style.display = "block";
                _window.document.getElementById("stdout").innerHTML += data;
                _window.document.getElementById("exitcode").innerHTML = "finished with exit code " + code;
                _window.document.getElementById("time").innerHTML = formatTime(elapsed);
            }
        });
        chain(connect, loadJasmineDomain, loadProcessDomain);
    });

   


    // Register commands as right click menu items
    commands = [ YUITEST_CMD, JASMINETEST_CMD, QUNITTEST_CMD, SCRIPT_CMD, NODETEST_CMD, GENERATE_JASMINE_CMD,
                 GENERATE_QUNIT_CMD, GENERATE_YUI_CMD, VIEWHTML_CMD];
    CommandManager.register("Run YUI Unit Test", YUITEST_CMD, runYUI);
    CommandManager.register("Run Jasmine xUnit Test", JASMINETEST_CMD, runJasmine);
    CommandManager.register("Run QUnit xUnit Test", QUNITTEST_CMD, runQUnit);
    CommandManager.register("Run Script", SCRIPT_CMD, runScript);
    CommandManager.register("Run Jasmine-Node xUnit Test", NODETEST_CMD, runJasmineNode);
    CommandManager.register("Generate Jasmine xUnit Test", GENERATE_JASMINE_CMD, generateJasmineTest);
    CommandManager.register("Generate Qunit xUnit Test", GENERATE_QUNIT_CMD, generateQunitTest);
    CommandManager.register("Generate YUI xUnit Test", GENERATE_YUI_CMD, generateYuiTest);
    CommandManager.register("xUnit View html", VIEWHTML_CMD, viewHtml);

    // check if the extension should add a menu item to the project menu (under the project name, left panel)
    $(projectMenu).on("beforeContextMenuOpen", function () {
        var selectedEntry = ProjectManager.getSelectedItem(),
            text = '';
        if (selectedEntry && selectedEntry.fullPath && DocumentManager.getCurrentDocument() !== null && selectedEntry.fullPath === DocumentManager.getCurrentDocument().file.fullPath) {
            text = DocumentManager.getCurrentDocument().getText();
        }
        cleanMenu(projectMenu);
        readConfig().done(function () {
            checkFileTypes(projectMenu, selectedEntry, text);
        });
    });
    
    // check if the extension should add a menu item to the workingset menu (under Working Files, left panel)
    $(workingsetMenu).on("beforeContextMenuOpen", function () {
        var selectedEntry = DocumentManager.getCurrentDocument().file,
            text = DocumentManager.getCurrentDocument().getText();
        cleanMenu(workingsetMenu);
        readConfig().done(function () {
            checkFileTypes(workingsetMenu, selectedEntry, text);
        });
    });
    exports.formatTime = formatTime;
    exports.checkFileTypes = checkFileTypes;
    exports.determineFileType = determineFileType;
    exports.parseIncludes = parseIncludes;
});




