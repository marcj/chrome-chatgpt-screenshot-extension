chrome.runtime.onConnect.addListener(function(port) {
    if (port.name == "capture") {
        port.onMessage.addListener(function(msg) {
            console.log('message', msg);
            window.scrollTo(0, msg.y);
        });
    }
});
