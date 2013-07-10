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
/*global brackets, define, $, window, Mustache, document */
define(function (require, exports, module) {
    'use strict';

    var AppInit             = brackets.getModule("utils/AppInit"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        FileUtils           = brackets.getModule("file/FileUtils"),
        Menus               = brackets.getModule("command/Menus"),
        NativeFileSystem    = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        ProjectManager      = brackets.getModule("project/ProjectManager"),
        FileViewController  = brackets.getModule("project/FileViewController");

    var moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
        templateEntry       = new NativeFileSystem.FileEntry(moduledir + '/templates/jasmineNodeReportTemplate.html'),
        reportJasNodeEntry  = new NativeFileSystem.FileEntry(moduledir + '/node/reports/jasmineReport.html'),
        COMMAND_ID          = "BracketsXUnit.BracketsXUnit",
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
        testFileIndex       = 0,
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
     *    dir = the base directory
     * returns: string of <script src="dir+path"/>
     */
    function parseIncludes(contents, dir, includeCodeCoverage) {
        var includes = '',
            codeCoverage = includeCodeCoverage ? ' data-cover' : '';
        if (contents && contents.match(/brackets-xunit:\s*includes=/)) {
            var includestr = contents.match(/brackets-xunit:\s*includes=[A-Za-z0-9,\._\-\/]*/)[0];
            includestr = includestr.substring(includestr.indexOf('=') + 1);
            var includedata = includestr.split(',');
            var i;
            for (i = 0; i < includedata.length; i++) {
                includes = includes + '<script src="' + dir + includedata[i] + '"' + codeCoverage + '></script>\n';
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
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var dir = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1),
            dirEntry = new NativeFileSystem.DirectoryEntry(dir),
            fname = DocumentManager.getCurrentDocument().filename,
            contents = DocumentManager.getCurrentDocument().getText(),
            testName = entry.fullPath.substring(entry.fullPath.lastIndexOf("/") + 1),
            testBase = testName.substring(0, testName.lastIndexOf('.')),
            yuiReportEntry = new NativeFileSystem.FileEntry(dir + testBase + '/yuiReport.html'),
            includes = parseIncludes(contents, dir),
            data = { filename : entry.name,
                     title : 'YUI test - ' + entry.name,
                     templatedir : moduledir,
                     includes : includes,
                     contents : contents
                   };
        var template = require("text!templates/yui.html");
        var html = Mustache.render(template, data);
        dirEntry.getDirectory(dir + testBase, {create: true}, function () {
            FileUtils.writeText(yuiReportEntry, html).done(function () {
                var report = window.open(yuiReportEntry.fullPath);
                report.focus();
            });
        });
    }
 
    // Execute Jasmine test
    function runJasmine() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var dir = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1),
            dirEntry = new NativeFileSystem.DirectoryEntry(dir),
            testName = entry.fullPath.substring(entry.fullPath.lastIndexOf("/") + 1),
            testBase = testName.substring(0, testName.lastIndexOf('.')),
            newTestName = testBase + (testFileIndex++) + ".js",
            contents = DocumentManager.getCurrentDocument().getText(),
            includes = parseIncludes(contents, dir),
            relpath = entry.fullPath.substring(ProjectManager.getInitialProjectPath().length - 1),
            jasmineTestName = dir + testBase + '/' + newTestName,
            jasmineTestEntry = new NativeFileSystem.FileEntry(jasmineTestName),
            jasmineHtmlName = dir + testBase + "/" + testBase + ".html",
            jasmineHtmlEntry = new NativeFileSystem.FileEntry(jasmineHtmlName),
            jasmineCss = require("text!templates/jasmine.css"),
            jasmineCssEntry = new NativeFileSystem.FileEntry(dir + testBase + "/jasmine.css"),
            jasmineJs = require("text!templates/jasmine.js"),
            jasmineJsEntry = new NativeFileSystem.FileEntry(dir + testBase + "/jasmine.js"),
            jasmineJsHtml = require("text!templates/jasmine-html.js"),
            jasmineJsHtmlEntry = new NativeFileSystem.FileEntry(dir + testBase + "/jasmine-html.js"),
            requireSrc = require("text!node/node_modules/jasmine-node/node_modules/requirejs/require.js"),
            requireSrcEntry = new NativeFileSystem.FileEntry(dir + testBase + "/require.js");
        var apiFile = contents.match(/require\('\.\/[A-Za-z0-9\-]+\.js/);
        
        
        dirEntry.getDirectory(testBase, {create: true}, function () {
            var data = {
                    filename : entry.name,
                    jasmineTest : newTestName,
                    title : 'Jasmine test - ' + entry.name,
                    includes : includes,
                    contents : DocumentManager.getCurrentDocument().getText()
                },
                template,
                html;
            if (data.contents.match(/define\(/)) {
                var filepath = { fullpath: entry.fullPath };
                template = require("text!templates/jasmine_requirejs.html");
                html = Mustache.render(template, data);
            } else {
                template = require("text!templates/jasmine.html");
                html = Mustache.render(template, data);
            }
            FileUtils.writeText(jasmineTestEntry, contents).done(function () {
                FileUtils.writeText(jasmineHtmlEntry, html).done(function () {
                    FileUtils.writeText(jasmineCssEntry, jasmineCss).done(function () {
                        FileUtils.writeText(jasmineJsEntry, jasmineJs).done(function () {
                            FileUtils.writeText(requireSrcEntry, requireSrc).done(function () {
                                FileUtils.writeText(jasmineJsHtmlEntry, jasmineJsHtml).done(function () {
                                    if (apiFile) {
                                        var apiFileName = apiFile[0].substring(11),
                                            apiFileEntry = new NativeFileSystem.FileEntry(dir + apiFileName),
                                            apiNewFileEntry = new NativeFileSystem.FileEntry(dir + testBase + '/' + apiFileName);
                                        FileUtils.readAsText(apiFileEntry).done(function (text, modtime) {
                                            FileUtils.writeText(apiNewFileEntry, text).done(function () {
                                                var reportWin = window.open(jasmineHtmlEntry.fullPath);
                                                reportWin.focus();
                                            });
                                        });
                                    } else {
                                        var reportWin = window.open(jasmineHtmlEntry.fullPath);
                                        reportWin.focus();
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
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
                var dlg = Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "Jasmine Error",
                    "The test file contained an error: " + err.toString()
                );
            });
    }

    // Runs a QUnit test
    function runQUnit() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === undefined) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var dir = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1),
            dirEntry = new NativeFileSystem.DirectoryEntry(dir),
            fname = DocumentManager.getCurrentDocument().filename,
            contents = DocumentManager.getCurrentDocument().getText(),
            testName = entry.fullPath.substring(entry.fullPath.lastIndexOf("/") + 1),
            testBase = testName.substring(0, testName.lastIndexOf('.')),
            qunitReportEntry    = new NativeFileSystem.FileEntry(dir + testBase + '/qUnitReport.html'),
            useCodeCoverage = true,
            includes = parseIncludes(contents, dir, useCodeCoverage);
        var data = { filename : entry.name,
                     title : 'QUnit test - ' + entry.name,
                     includes : includes,
                     templatedir : moduledir,
                     contents : contents,
                     coverage: "<script src='https://raw.github.com/alex-seville/blanket/master/dist/qunit/blanket.min.js'></script>"
                   };
        var template = require("text!templates/qunit.html");
        var html = Mustache.render(template, data);
        // write generated test report to file on disk
        dirEntry.getDirectory(dir + testBase, {create: true}, function () {
            FileUtils.writeText(qunitReportEntry, html).done(function () {
                // launch new window with generated report
                var report = window.open(qunitReportEntry.fullPath);
                report.focus();
            });
        });
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
        var filename = DocumentManager.getCurrentDocument().file.name;
        var acorn = require('thirdparty/acorn/acorn_loose');
        var walk = require('thirdparty/acorn/walk');
        var ast = acorn.parse_dammit(text);
        var i, j, functions = [], fparams, fname, fparamstr;
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
        function _getUntitledFileSuggestion(dir, baseFileName, fileExt, isFolder) {
            var result = new $.Deferred();
            var suggestedName = baseFileName + fileExt;
            var dirEntry = new NativeFileSystem.DirectoryEntry(dir);

            result.progress(function attemptNewName(suggestedName, nextIndexToUse) {
                if (nextIndexToUse > 99) {
                    //we've tried this enough
                    result.reject();
                    return;
                }

                //check this name
                var successCallback = function (entry) {
                    //file exists, notify to the next progress
                    result.notify(baseFileName + "-" + nextIndexToUse + fileExt, nextIndexToUse + 1);
                };
                var errorCallback = function (error) {
                    //most likely error is FNF, user is better equiped to handle the rest
                    result.resolve(suggestedName);
                };
            
                if (isFolder) {
                    dirEntry.getDirectory(
                        suggestedName,
                        {},
                        successCallback,
                        errorCallback
                    );
                } else {
                    dirEntry.getFile(
                        suggestedName,
                        {},
                        successCallback,
                        errorCallback
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
            isnode = contents.match(/node\w*\:true/),
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

    // setup, connects to the node server loads node/JasmineDomain and node/ProcessDomain
    AppInit.appReady(function () {
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
                var dlg = Dialogs.showModalDialog(
                    Dialogs.DIALOG_ID_ERROR,
                    "Jasmine Node Error",
                    jsondata.substring(7)
                );
            } else {
                FileUtils.readAsText(templateEntry).done(function (text, timestamp) {

                    jsondata = jsondata.replace(/'/g, "");
                    
                    var jdata = JSON.parse(jsondata);
                    var totaltime = 0;
                    var i;
                    for (i = 0; i < jdata.length; i++) {
                        totaltime = totaltime + parseFloat(jdata[i].time);
                    }
                    var html = Mustache.render(text, {jsondata: jsondata, time: totaltime});
                    FileUtils.writeText(reportJasNodeEntry, html).done(function () {
                        window.open(reportJasNodeEntry.fullPath);
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

        function processOutput(pid, data) {
            var status = '';
            if (_windows[pid].done === false) {
                if (data.indexOf("=== Summary ===") > -1) {
                    _windows[pid].done = true;
                }
                var passes = data.match(/passed/g);
                if (passes === null) {
                    passes = 0;
                } else {
                    passes = passes.length;
                }
                _windows[pid].passes += passes;
                if (passes > 0) {
                    status += '<span style="color:green">' + _windows[pid].passes + ' passes</span>, ';
                } else {
                    status += _windows[pid].passes + " passes, ";
                }
                var failures = data.match(/failed in (non-)?strict mode ===<br>/g);
                if (failures === null) {
                    failures = 0;
                } else {
                    failures = failures.length;
                }
                _windows[pid].fails += failures;
                if (_windows[pid].fails === 0) {
                    status += "0 failures";
                } else {
                    status += ' <span style="color:red">' + _windows[pid].fails + ' failures</span>';
                }
                var expectedfailures = data.match(/failed in (non-)?strict mode as expected<br>/g);
                if (expectedfailures === null) {
                    expectedfailures = 0;
                } else {
                    expectedfailures = expectedfailures.length;
                }
                _windows[pid].expfails += expectedfailures;
                if (_windows[pid].expfails > 0) {
                    status += ", " + _windows[pid].expfails + " expected failures";
                }
                _windows[pid].window.document.getElementById("status" + pid).innerHTML = status;
            }
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
                    _type = _windows[pid].type,
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
                    _type = _windows[pid].type,
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

    // reads config.js to determine if brackets-xunit should be disabled for the current project     
    function readConfig() {
        var result = new $.Deferred();
        var root = ProjectManager.getProjectRoot(),
            configEntry = new NativeFileSystem.FileEntry(root.fullPath + "config.js");
        FileUtils.readAsText(configEntry).done(function (text, timestamp) {
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
        }).fail(function (error) {
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
    $(projectMenu).on("beforeContextMenuOpen", function (evt) {
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
    $(workingsetMenu).on("beforeContextMenuOpen", function (evt) {
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