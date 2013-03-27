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
        NativeFileSystem    = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        ProjectManager      = brackets.getModule("project/ProjectManager");
    
    var moduledir           = FileUtils.getNativeModuleDirectoryPath(module),
        jasmineReportEntry  = new NativeFileSystem.FileEntry(moduledir + '/generated/jasmineReport.html'),
        qunitReportEntry    = new NativeFileSystem.FileEntry(moduledir + '/generated/qUnitReport.html'),
        COMMAND_ID          = "BracketsXUnit.BracketsXUnit",
        YUITEST_CMD         = "yuitest_cmd",
        JASMINETEST_CMD     = "jasminetest_cmd",
        QUNITTEST_CMD       = "qunit_cmd",
        projectMenu         = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        workingsetMenu      = Menus.getContextMenu(Menus.ContextMenuIds.WORKING_SET_MENU),
        nodeConnection      = null,
        logPrefix           = "xUnit - ";

    console.log(logPrefix + "Initializng");
    
    // Execute YUI test
    function runYUI() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === null) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var data = { filename : entry.name,
                     title : 'YUI test - ' + entry.name,
                     templatedir : moduledir,
                     contents : DocumentManager.getCurrentDocument().getText()
                   };
        var template = require("text!templates/yui.html");
        var html = Mustache.render(template, data);
        console.log(logPrefix + "Launching YUI test");
        var resultWindow = window.open('about:blank', null, 'width=600,height=200');
        resultWindow.document.write(html);
        resultWindow.focus();
    }
 
    // Execute Jasmine test
    function runJasmine() {
        var entry = ProjectManager.getSelectedItem();
        if (entry === null) {
            entry = DocumentManager.getCurrentDocument().file;
        }
        var dir = entry.fullPath.substring(0, entry.fullPath.lastIndexOf('/') + 1);
        var contents = DocumentManager.getCurrentDocument().getText(),
            includes = '';

        if (contents.match(/brackets-xunit:\s*includes=/)) {
            var includestr = contents.match(/brackets-xunit:\s*includes=[A-Za-z0-9,\._\-\/]*/)[0];
            includestr = includestr.substring(includestr.indexOf('=') + 1);
            var includedata = includestr.split(',');
            var i;
            for (i = 0; i < includedata.length; i++) {
                includes = includes + '<script src="'+dir+includedata[i]+'"></script>\n';
            }
        }
        var data = { filename : entry.name,
                     title : 'Jasmine test - ' + entry.name,
                     includes : includes,
                     contents : DocumentManager.getCurrentDocument().getText()
                   };
        var template = require("text!templates/jasmine.html");
        var html = Mustache.render(template, data);
        FileUtils.writeText(jasmineReportEntry, html).done(function () {
            console.log(logPrefix + "Launching Jasmine test");
            var report = window.open(jasmineReportEntry.fullPath);
            report.focus();
        });
    }
    
    // Execute QUnit test
    function runQUnit() {
        var entry = ProjectManager.getSelectedItem();
        var f = entry.fullPath;
        if (entry === null) {
            entry = DocumentManager.getCurrentDocument();
            f = entry.fullPath;
        }
        var fname = DocumentManager.getCurrentDocument().filename;
        var data = { filename : entry.name,
                     title : 'QUnit test - ' + entry.name,
                     templatedir : moduledir,
                     contents : DocumentManager.getCurrentDocument().getText(),
                     testSrcURL: "file://localhost" + f
                   };
        var template = require("text!templates/qunit.html");
        var html = Mustache.render(template, data);
        console.log(logPrefix + "Launching QUnit test");
        // write generated test report to file on disk
        FileUtils.writeText(qunitReportEntry, html).done(function () {
            // launch new window with generated report
            var report = window.open(qunitReportEntry.fullPath);
            report.focus();
        });
    }
    
    // determine if a file is a known test type
    // first look for brackets-xunit: [type], takes precedence
    // next look for distinguishing clues in the file:
    //   YUI: 'YUI(' and 'Test.runner.test'
    //   jasmine: 'describe' and 'it'
    //   QUnit: 'test()' and 'it()'
    // todo: unit test this function
    function determineFileType(fileEntry) {
        if (fileEntry) {
            var text = DocumentManager.getCurrentDocument().getText();
            if (text.match(/brackets-xunit:\s*yui/i) !== null) {
                return "yui";
            } else if (text.match(/brackets-xunit:\s*jasmine/i) !== null) {
                return "jasmine";
            } else if (text.match(/brackets-xunit:\s*qunit/i) !== null) {
                return "qunit";
            } else if (text.match(/YUI\s*\(/) && text.match(/Test\.Runner\.run\s*\(/)) {
                return "yui";
            } else if (text.match(/describe\s*\(/) && text.match(/it\s*\(/)) {
                return "jasmine";
            } else if (text.match(/test\s*\(/) && text.match(/ok\s*\(/)) {
                return "qunit";
            }
        }
        return "unknown";
    }
    
    // Register commands as right click menu items
    CommandManager.register("Run YUI Unit Test", YUITEST_CMD, function () {
        runYUI();
    });
    CommandManager.register("Run Jasmine xUnit Test", JASMINETEST_CMD, function () {
        runJasmine();
    });
    CommandManager.register("Run QUnit xUnit Test", QUNITTEST_CMD, function () {
        runQUnit();
    });
    
    // Determine type of test for selected item in project
    $(projectMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = ProjectManager.getSelectedItem();
        projectMenu.removeMenuItem(YUITEST_CMD);
        projectMenu.removeMenuItem(JASMINETEST_CMD);
        projectMenu.removeMenuItem(QUNITTEST_CMD);
        
        var type = determineFileType(selectedEntry);
        console.log(logPrefix + "Test type: " + type);
        
        if (type === "yui") {
            projectMenu.addMenuItem(YUITEST_CMD, "", Menus.LAST);
        } else if (type === "jasmine") {
            projectMenu.addMenuItem(JASMINETEST_CMD, "", Menus.LAST);
        } else if (type === "qunit") {
            projectMenu.addMenuItem(QUNITTEST_CMD, "", Menus.LAST);
        }
    });
    
    // Determine type of test for selected item in working set
    $(workingsetMenu).on("beforeContextMenuOpen", function (evt) {
        var selectedEntry = DocumentManager.getCurrentDocument().file;
        workingsetMenu.removeMenuItem(YUITEST_CMD);
        workingsetMenu.removeMenuItem(JASMINETEST_CMD);
        workingsetMenu.removeMenuItem(QUNITTEST_CMD);
        
        var type = determineFileType(selectedEntry);
        console.log(logPrefix + "Test type: " + type);
        
        if (type === "yui") {
            workingsetMenu.addMenuItem(YUITEST_CMD, "", Menus.LAST);
        } else if (type === "jasmine") {
            workingsetMenu.addMenuItem(JASMINETEST_CMD, "", Menus.LAST);
        } else if (type === "qunit") {
            workingsetMenu.addMenuItem(QUNITTEST_CMD, "", Menus.LAST);
        }
    });

});
