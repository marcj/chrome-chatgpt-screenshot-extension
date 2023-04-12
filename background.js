// function capture() {
//     console.log('captrure');
//     chrome.tabs.captureVisibleTab(null, {format: "png", quality: 70}, function (data) {
//         console.log('done?', data);
//         var image = new Image();
//         const content = document.createElement("canvas");
//         image.onload = function () {
//             var canvas = content;
//             canvas.width = image.width;
//             canvas.height = image.height;
//             var context = canvas.getContext("2d");
//             context.drawImage(image, 0, 0);
//
//             // save the image
//             var link = document.createElement('a');
//             link.download = "chatGPT.png";
//             link.href = content.toDataURL();
//             link.click();
//         };
//         image.src = data;
//     });
// }

function sleep(ms = 50) {
    return new Promise(r => setTimeout(r, ms));
}

// function setDeviceMetricsOverride(tabId, { height, width }) {
//     const ops = { height: height, width: width, deviceScaleFactor: 1, captureBeyondViewport: false, mobile: false };
//     return new Promise((resolve) => {
//         chrome.debugger.sendCommand({ tabId }, "Emulation.setDeviceMetricsOverride", ops, resolve);
//     });
// }
//
// async function captureFullpage(tabId, options) {
//     await chrome.debugger.attach({ tabId }, "1.3");
//     await chrome.debugger.sendCommand({ tabId }, "Page.enable");
//     await sleep();
//
//     await chrome.debugger.sendCommand({ tabId }, "Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
//     await sleep();
//
//     const layout = await chrome.debugger.sendCommand({ tabId }, "Page.getLayoutMetrics");
//     console.log(layout);
//
//     // await sleep();
//
//     // await setDeviceMetricsOverride(tabId, { height: contentSize.height, width: contentSize.width }); // returns empty object
//
//     return new Promise((resolve, reject) => {
//         const ops = { format: options.format, fromSurface: options.fromSurface };
//         chrome.debugger.sendCommand({ tabId }, "Page.captureScreenshot", ops, async (response) => {
//             if (chrome.runtime.lastError) {
//                 reject(chrome.runtime.lastError);
//             } else {
//                 let base64Data = `data:image/png;base64,${response.data}`;
//                 // await sleep(Math.ceil(contentSize.height / 30));
//                 // await chrome.debugger.sendCommand({ tabId }, "Emulation.clearDeviceMetricsOverride"); // returns empty object
//                 await chrome.debugger.detach({ tabId });
//                 await sleep();
//                 resolve(base64Data);
//             }
//         });
//     });
// }

async function getCurrentTab() {
    let queryOptions = {active: true, lastFocusedWindow: true};
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

async function captureSegment(port, tabId, y) {
    return new Promise(async (resolve) => {
        port.postMessage({y: y});
        await sleep();
        chrome.tabs.captureVisibleTab(null, {format: "png", quality: 70}, function (data) {
            resolve(data);
        });
    })
}

async function capture(port, tabId, scrollHeight) {
    const tab = await getCurrentTab();
    // tab.height = ;
    const segments = Math.ceil(scrollHeight / tab.height);
    const images = [];
    console.log('visible height', tab.height);
    console.log('max height', scrollHeight);
    console.log('segments', segments);
    
    for (let i = 0; i < segments; i++) {
        images.push(await captureSegment(port, tabId, tab.height * i));
        await sleep(510);
    }
    console.log('images', images);

    const res = await chrome.scripting.executeScript({
        target: {tabId},
        args: [tab.width, tab.height, segments, images, scrollHeight],
        async function(tabWidth, tabHeight, segments, images, scrollHeight) {
    
            // console.log('wtf', tabWidth, tabHeight);
            
            var dpr = window.devicePixelRatio; // E.g. "1.5" as a float.
            
            const canvas = document.createElement("canvas");
            var context = canvas.getContext("2d");
            canvas.width = Math.ceil(850 * dpr);
            canvas.height = Math.ceil(scrollHeight * dpr);
            for (let i = segments - 1; i >= 0; i--) {
                await new Promise((resolve) => {
                    var image = new Image();
                    image.width = Math.ceil(tabWidth * dpr);
                    image.height = Math.ceil(tabHeight * dpr);
                    image.onload = function () {
                        // context.drawImage(image, 0, 0, 850, tabHeight, 0, tabHeight * i, 850, tabHeight);
                        // console.log('image', image.width, image.height);
                        if (i === segments - 1) {
                            //last is likely not the full height
                            const remainder = scrollHeight % tabHeight;
                            /* If no scrolling, do not cut off. */
                            const cutOff = segments === 1 ? 0 : Math.ceil((tabHeight - remainder) * dpr);
                            // context.drawImage(image, 0, cutOff, tabWidth, remainder, 0, tabHeight * i, tabWidth, remainder);
                            context.drawImage(image, 0, Math.ceil(tabHeight * i * dpr) - cutOff, Math.ceil(tabWidth*dpr), Math.ceil(tabHeight * dpr));
                        } else {
                            context.drawImage(image, 0, Math.ceil(tabHeight * i * dpr), Math.ceil(tabWidth * dpr), Math.ceil(tabHeight * dpr));
                        }
                        // context.drawImage(image, 0, tabHeight * i, tabWidth, tabHeight);
                        resolve();
                    };
                    image.src = images[i];
                    // document.body.appendChild(image);
                });
            }
            // console.log('done', canvas.toDataURL());
            return canvas.toDataURL();
        }
    });

    return res[0].result;
}

function resetPage() {
    document.body.classList.remove('screenshotGpt');
}

async function prePage() {
    window.addEventListener("message", function (event) {
        console.log('got message', event);
    });

    if (!document._customStylesAdded) {
        const styleElement = document.createElement("style");
        styleElement.innerHTML = `
        body.screenshotGpt {
            height: unset;
            max-width: 850px;
        }
        
        /* Hide left history & Co. sidebar. */
        body.screenshotGpt > div > div > div:first-child {
            display: none;
        }
        
        /* Show content area. */
        body.screenshotGpt > div > div > div:last-child {
            padding-left: unset;
        }
        
        body.screenshotGpt main {
            display: block;
        }
        
        /* Bonus: Hide "Model: GPT-4" etc. top row. */
        body.screenshotGpt main > div > div > div > div > div:first-child {
            display: none;
        }
        
        /* Bonus: Hide text box area content. */
        body.screenshotGpt main > div:last-child {
            display: none;
        }
        
        /* Bonus: Hide text box area outer. */
        body.screenshotGpt main > div > div > div > div > div:last-child {
            display: none;
        }
        `;
        document.head.appendChild(styleElement);
    }
    document._customStylesAdded = true;

    document.body.classList.add('screenshotGpt');

    return document.body.scrollHeight;
}

// chrome.action.onClicked.addEventListener((tab) => {
//     if (tab.url.includes("chat.openai.com")) {
//         chrome.scripting.executeScript({
//             target: {tabId: tab.id},
//             function: reddenPage
//         });
//         capture();
//     }
// });

function download(dataurl, filename) {
    const link = document.createElement("a");
    link.href = dataurl;
    link.download = filename;
    link.click();
}

chrome.action.onClicked.addListener(async (tab) => {
    const response = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        function: prePage
    });

    const port = chrome.tabs.connect(tab.id, {name: "capture"});


    capture(port, tab.id, response[0].result).then(dataUrl => {
        chrome.scripting.executeScript({
            func: download,
            target: {tabId: tab.id},
            args: [dataUrl, 'chatGPT.png'],
        });

        chrome.scripting.executeScript({
            target: {tabId: tab.id},
            function: resetPage
        });
    });

    // chrome.tabs.captureVisibleTab(async (dataUrl) => {
    //     await chrome.scripting.executeScript({
    //         func: download,
    //         target: { tabId: tab.id },
    //         args: [dataUrl, 'chatGPT.png'],
    //     });
    // });
});
