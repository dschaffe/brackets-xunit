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
 */
/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, brackets, $, global, require, process, exports */
 
(function () {
    "use strict";
    
    var spawn = require("child_process").spawn;

    var _sessions = {},
        domainManager,
        cacheTimeDefault = 3000;  // minimum time in seconds to send stdout data through the process.stdout event

    function spawnSession(info) {
        var command = info.executable,
            parameters = info.args,
            directory = info.directory,
            shell = info.shells,
            cacheTime = info.cacheTime,
            env = {};
        if (cacheTime === undefined) {
            cacheTime = cacheTimeDefault;
        }
        if (parameters === undefined) {
            parameters = [];
        }
        if (env === undefined) {
            env = {};
        }
        if (directory === undefined) {
            directory = command.substring(0, command.lastIndexOf('/'));
        }
        var session = spawn(command, parameters, { cwd: directory });
        _sessions[session.pid] = {session: session, lastSentTime: Number(new Date()), cacheData: '', cacheTime: cacheTime};
        
        session.stdout.setEncoding();
        session.stdout.on("data", function (data) {
            var result = _sessions[session.pid];
            if (Number(new Date()) - result.lastSentTime > result.cacheTime) {
                result.lastSentTime = Number(new Date());
                domainManager.emitEvent("process", "stdout", {pid: session.pid, data: result.cacheData + data});
                result.cacheData = '';
            } else {
                result.cacheData += data;
            }
        });
    
        session.stderr.setEncoding();
        session.stderr.on("data", function (data) {
            domainManager.emitEvent("process", "stderr", {pid: session.pid, data: data});
        });
    
        session.on("exit", function (code) {
            var result = _sessions[session.pid];
            domainManager.emitEvent("process", "exit", { pid : session.pid, exitcode : code, data: result.cacheData});
        });
    
        var cmds = [command];
        cmds = cmds.concat(parameters);
        return [session.pid, cmds, shell];
    }
    
    function killSession(pid) {
        var session = _sessions[pid].session;
    
        if (session) {
            session.kill();
        }
    }

    function init(DomainManager) {
        domainManager = DomainManager;

        if (!DomainManager.hasDomain("process")) {
            DomainManager.registerDomain("process", {major: 0, minor: 1});
        }

        DomainManager.registerCommand(
            "process",         // domain name
            "spawnSession",    // command name
            spawnSession,      // command handler function
            false,              // this command is synchronous
            "Opens a new session",
            [
                {
                    name: "initialDirectory",
                    type: "string",
                    description: "Initial directory path"
                }
            ],
            [
                {
                    name: "session",
                    type: "number",
                    description: "session data"
                }
            ]
        );

        // command: process.killSession(pid)
        DomainManager.registerCommand(
            "process",         // domain name
            "killSession",      // command name
            killSession,        // command handler function
            false,              // this command is synchronous
            "Kills a spawned process",
            [
                {
                    name: "pid",
                    type: "number",
                    description: "PID of the session to destroy"
                }
            ]
        );

        // event: process.stdout
        DomainManager.registerEvent(
            "process",
            "stdout",
            [
                {
                    name: "pid",
                    type: "number",
                    description: "Shell PID"
                },
                {
                    name: "message",
                    type: "string",
                    description: "stdout message"
                }
            ]
        );
        // event: process.stderr
        DomainManager.registerEvent(
            "process",
            "stderr",
            [
                {
                    name: "pid",
                    type: "number",
                    description: "Shell PID"
                },
                {
                    name: "message",
                    type: "string",
                    description: "stderr message"
                }
            ]
        );
        // event: process.exit
        DomainManager.registerEvent(
            "process",
            "exit",
            [
                {
                    name: "pid",
                    type: "number",
                    description: "Shell PID"
                },
                {
                    name: "result",
                    type: "object",
                    description: "exit code"
                }
            ]
        );
    }
    exports.init = init;
}());