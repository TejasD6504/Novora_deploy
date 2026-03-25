const { PythonShell } = require('python-shell');

function detectAGV(onDetect) {
    const pyshell = new PythonShell('agvdetect.py', {
        pythonPath: 'python', // or python3
        scriptPath: './'
    });

    pyshell.on('message', (msg) => {
        // console.log("From Python:", msg);

        if (msg.startsWith("AGV")) {
            onDetect(msg);
        }
    });

    pyshell.on('stderr', (stderr) => {
        console.error("Python error:", stderr);
    });

    pyshell.on('close', () => {
        console.log("Python script ended.");
    });
}

module.exports = detectAGV;
