chrome.runtime.onInstalled.addListener(function(details){
    if(details.reason == "install"){
      chrome.storage.sync.set({
        bugs: []
      }, () => {
        setBugOuterProgress(0);
      });
    }
    chrome.storage.sync.get(['bugs'], (result) => {
        setBugOuterProgress(result.bugs);
    })
});

function setBugOuterProgress(bugs) {    
        if(bugs && bugs.length) {        
            let totalBugs = bugs.length;
            let resolvedBugs = bugs.filter(bug => bug.resolved === true).length;        
            var badgeText = totalBugs - resolvedBugs;
            if(badgeText > 9)        {
                badgeText = '9+';
            }
            chrome.action.setBadgeText({text: badgeText.toString()});   
        } else {
            chrome.action.setBadgeText({text: '0'});   
        }    
}