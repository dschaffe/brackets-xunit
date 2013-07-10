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
 * jasmine unit tests for xunit extension
 */

require.config({
    baseUrl: "../..",
    paths: {
        "text" : "thirdparty/text/text", // set to path of text.js from require.js
    }
});
// define mocks for brackets to enable headless testing of extension
brackets = {
    getModule : function (name) {
        console.log("getModule: "+name);
        if (name === "file/NativeFileSystem" ) {
            return { NativeFileSystem : {
                FileEntry : function(entry) {
                    console.log("NativeFileSystem.Entry:" + entry);                    
                    return {
                        fullPath : entry
                    };
                }
            } };
        } else if (name === "file/FileUtils") {
            return { 
                getNativeModuleDirectoryPath : function(module) {
                    console.log("FileUtils.getNativeModuleDirectoryPath " + module);
                    return module;
                },
                readAsText : function(entry) {
                    console.log("FileUtils.readAsText " + entry.fullPath);
                    var result = new $.Deferred();
                    return result;
                }
            };
        } else if (name === "command/Menus") {
            return { 
                getContextMenu : function (name) {
                    console.log("Menus.getContextMenu: "+name);
                    return name;
                },
                ContextMenuIds : {
                    PROJECT_MENU : "Project",
                    WORKING_SET_MENU : "WorkingSet"
                }
            }
        } else if (name === "utils/NodeConnection") {
            return function () {
                console.log("NodeConnection constructor");
            }
        } else if (name === "utils/AppInit") {
            return {
                appReady : function() {
                    console.log("called appReady");
                }
            }
        } else if (name === "command/CommandManager") {
            return {
                register : function(name, menu, fn) {
                    console.log("CommandManager.register " + name + " " + menu);
                }
            }
        }
    }
};    
define(function (require, exports, module) {
    'use strict';
    var testapi = require('../../main.js');
    describe("test formatTime(ms) - converts number in ms to string representation of hours, minutes, seconds.", function () {
        it("formatTime(0) === 0s", function () {
            expect(testapi.formatTime(0)).toEqual("0s");
        });
        it("formatTime(1000) === 1s", function () {
            expect(testapi.formatTime(1000)).toEqual("1s");
        });
        it("formatTime(100) === 0.1s", function () {
            expect(testapi.formatTime(100)).toEqual("0.1s");
        });
        it("formatTime(60*1000) === 1m", function () {
            expect(testapi.formatTime(60*1000)).toEqual("1m");
        });
        it("formatTime(61*1000+500) === 1m 1.5s", function () {
            expect(testapi.formatTime(61*1000+500)).toEqual("1m 1.5s");
        });
        it("formatTime(60*60*1000) === 1h", function () {
            expect(testapi.formatTime(60 * 60 * 1000)).toEqual("1h");
        });
        it("formatTime(60*60*24*1000) === 1d", function () {
            expect(testapi.formatTime(60 * 24 * 60 * 1000)).toEqual("1d");
        });
        it("formatTime(60*60*24*365*1000) === 1y", function () {
            expect(testapi.formatTime(60 * 60 * 24 * 365 * 1000)).toEqual("1y");
        });
        it("formatTime(60*60*1000+(10*60*1000)+(30200)) === 1h 10m 30.2s", function () {
            expect(testapi.formatTime(60 * 60 * 24 * 365 * 1000)).toEqual("1y");
        });
        it("formatTime(null) === 0s", function () {
            expect(testapi.formatTime(null)).toEqual("0s");
        });
    });
    describe("test determineFileType(entry,text) - determines if the file is a known test type e.g. jasmine, qunit, yui. ", function() {
        var NativeFileSystem = brackets.getModule("file/NativeFileSystem").NativeFileSystem;
        it("determineFileType(null,null) === 'unknown'", function() {
            expect(testapi.determineFileType(null,null)).toEqual("unknown");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.html','') === 'html'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.html',''))).toEqual("html");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.py','#!/usr/bin/env python') === 'script'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.py'),'#!/usr/bin/env python')).toEqual("script");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.js',null) === 'unknown'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.js'),null)).toEqual("unknown");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.js','brackets-xunit: '+'Yui') === 'yui'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.js'),'\n\n\nbrackets-xunit:' + '    Yui')).toEqual("yui");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.js','brackets-xunit: '+'Jasmine') === 'jasmine'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.js'),'\n\n\nbrackets-xunit:' + '    Jasmine')).toEqual("jasmine");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.js','brackets-xunit: '+'Jasmine-node') === 'node'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.js'),'\n\n\nbrackets-xunit:' + '    Jasmine-node')).toEqual("node");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.js','brackets-xunit: '+'qunit') === 'qunit'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.js'),'\n\n\nbrackets-xunit:' + '    qunit')).toEqual("qunit");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.js','describe() it()' === 'jasmine'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.js'),'describe() it()')).toEqual("jasmine");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.js','YUI() Test.Runner.run()' === 'yui'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.js'),'YUI() Test.Runner.run()')).toEqual("yui");
        });
        it("determineFileType(new NativeFileSystem.FileEntry('test.js','test() ok()' === 'qunit'", function () {
            expect(testapi.determineFileType(new NativeFileSystem.FileEntry('test.js'),'test() ok()')).toEqual("qunit");
        });
    });
    describe("test checkFileTypes(menu, entry, text) - adds detected file type to the menu.", function() {
        // mock a menu by implementing removeMenuItem, addMenuItem, getMenuItems
        var TestMenu = function() {
            return {
                menuitems : [],
                getMenuItems : function() { 
                    return this.menuitems;
                },
                removeMenuItem : function (item) {
                    console.log("removeMenuItem: " + item);
                },
                addMenuItem : function (id, shortcut, position) {
                    console.log("addMenuItem: " + id);
                    this.menuitems.push(id);
                },
                cleanup : function () {
                    this.menuitems = [];
                }
            };
        },
        NativeFileSystem = brackets.getModule("file/NativeFileSystem").NativeFileSystem,
        testFile = new NativeFileSystem.FileEntry("test.js"),
        scriptFile = new NativeFileSystem.FileEntry("test.py");
        var menu1 = new TestMenu();
        it("checkFileTypes(menu,null,null) === []", function() {
            testapi.checkFileTypes(menu1, null, null);
            expect(menu1.getMenuItems()).toEqual([]);
        });
        var menu2 = new TestMenu();
        it("checkFileTypes(menu,new test.js, 'brackets:xunit: jasmine') === [jasmine_cmd]", function() {
            testapi.checkFileTypes(menu2, testFile, 'brackets-xunit: jasmine');
            expect(menu2.getMenuItems()).toEqual(['jasminetest_cmd']);
        });
        var menu3 = new TestMenu();
        it("checkFileTypes(menu,new test.js, '#!/usr/bin/env python') === [script_cmd]", function() {
            testapi.checkFileTypes(menu3, scriptFile, '#!/usr/bin/env/python');
            expect(menu3.getMenuItems()).toEqual(['script_cmd']);
        });
        var menu4 = new TestMenu();
        it("checkFileTypes(menu,new test.js, 'test() ok()') === [qunit]", function() {
            testapi.checkFileTypes(menu4, testFile, 'test() ok()');
            expect(menu4.getMenuItems()).toEqual(['qunit_cmd']);
        });
        var menu5 = new TestMenu();
        it("checkFileTypes(menu,new test.js, '') === [generate_jasmine_cmd, generate_qunit_cmd, generate_yui_cmd]", function() {
            testapi.checkFileTypes(menu5, testFile, 'function foo() {};');
            expect(menu5.getMenuItems()).toEqual(['generate_jasmine_cmd', 'generate_qunit_cmd', 'generate_yui_cmd']);
        });
    });
    describe("test parseIncludes(contents,dir/,cache) - parse includes from brackets-xunit: includes and build <script src>", function() {
        it("parseIncludes('','') == ''", function() {
            expect(testapi.parseIncludes('', '')).toEqual('');
        });
        it("parseIncludes('one,two*,three','dir/','cache') == '<script src='dir/one?u=cache'><script src='dir/three?u=cache'><script src='dir/two?u=cache' data-cover>'", function() {
            expect(testapi.parseIncludes('header\nbrackets-xunit:  includes=one,two*,three', 'dir/','cache')).toEqual(
              '<script src="dir/one?u=cache"></script>\n' +
              '<script src="dir/two" data-cover></script>\n' +
              '<script src="dir/three?u=cache"></script>\n');
        });
        it("parseIncludes('one,two*,three','dir/') == '<script src='dir/one'><script src='dir/three'><script src='dir/two' data-cover>'", function() {
            expect(testapi.parseIncludes('header\nbrackets-xunit:  includes=one,two*,three', 'dir/')).toEqual(
              '<script src="dir/one"></script>\n' +
              '<script src="dir/two" data-cover></script>\n' +
              '<script src="dir/three"></script>\n');
        });
    });
});

