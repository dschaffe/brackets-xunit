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
/*jslint indent: 4, maxerr: 50 */
/*global define, brackets, $, global, require, process, exports */
 
// The code runs in brackets node server
// functions:
//      process.spawnSession() 
//      process.killSession(pid)
// events:
//      stdout returns object{pid,data} 
//      stderr returns object{pid,data}
//      exit returns object{pid,exitcode}

(function () {
    "use strict";
    
    var spawn = require("child_process").spawn,
        path = require("path"),
        sessions = {},
        domainManager,
        cmds,
        cacheTimeDefault = 3000;  // minimum time in milliseconds to send stdout data through the process.stdout event
                                  // passing data too frequently to the brackets process overloads the editor
   /*
    * spawnSession - runs an executable file using node's child_process.spawn.
    *
    * parmeters: object {executable, args, shell, directory, cacheTime, env}
    *            executable = file to run
    *            args = array of arguments to execute
    *            shell = key to return identifying the process
    *            directory = initial directory (cwd) to execute process
    *            cacheTime = time in ms for minimum frequency to return stdout data
    *            env = object environment variables to pass
    * returns: object{pid,commands,errors}
    *            pid = os process id
    *            commands = array of executable and parameters
    *            errors = any error messages caught during spawn
    */
    function spawnSession(info) {
        var command = info.executable,
            parameters = info.args,
            shell = info.shells,
            errors = '',
            session,
            directory,
            cacheTime,
            env,
            i;
        try {
            directory = info.directory;
            cacheTime = info.cacheTime;
            env = info.env;
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
            directory = directory.replace(/\//g, path.sep);
            for (i = 0; i < parameters.length; i += 1) {
                parameters[i] = parameters[i].replace(/\//g, path.sep);
            }
            session = spawn(command, parameters, { cwd: directory, env: env });
            sessions[session.pid] = {session: session, lastSentTime: Number(new Date()), cacheData: '', cacheTime: cacheTime};
            session.stdout.setEncoding();
            session.stdout.on("data", function (data) {
                var result = sessions[session.pid];
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
                var result = sessions[session.pid];
                domainManager.emitEvent("process", "exit", { pid : session.pid, exitcode : code, data: result.cacheData});
            });
    
        } catch (e) {
            errors = e.message;
        }
        cmds = [command];
        cmds = cmds.concat(parameters);
        return {pid: session.pid, commands: cmds, errors: errors};
    }
    
    /* kills a process
     *     pid - the process id
     */
    function killSession(pid) {
        var session = sessions[pid].session;
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
            "Spawns a new process",
            [
            ]
        );

        // command: process.killSession(pid)
        DomainManager.registerCommand(
            "process",         // domain name
            "killSession",      // command name
            killSession,        // command handler function
            false,              // this command is synchronous
            "Kills a spawned process",
            []
        );

        // event: process.stdout
        DomainManager.registerEvent(
            "process",
            "stdout",
            []
        );
        // event: process.stderr
        DomainManager.registerEvent(
            "process",
            "stderr",
            []
        );
        // event: process.exit
        DomainManager.registerEvent(
            "process",
            "exit",
            []
        );
    }
    exports.init = init;
}());