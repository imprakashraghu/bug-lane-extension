var progressLine = null;

document.addEventListener('DOMContentLoaded', async () => {         
    progressLine = new ProgressBar.Line('#bugProgress', {
        easing: 'easeInOut',
        trailColor: '#16213e',
        strokeWidth: 2,
        color: '#ED6A5A',        
        text: {
            style: {
            // Text color.
            // Default: same as stroke color (options.color)
            color: 'lightgrey',
            position: 'absolute',
            right: '30px',
            top: '40px',
            padding: 0,
            margin: 0,
            transform: null
            },            
            autoStyleContainer: false
        },
        from: {color: '#000'},
        to: {color: '#ED6A5A'},
        step: (state, bar) => {
            bar.setText(Math.round(bar.value() * 100) + ' %');
        }
    });             
    // LOADING INITIAL STATES     
    chrome.storage.sync.get(['username','bugs'], (result) =>  {        
        document.getElementById('username').innerText = result.username || 'Guest';
        if(result.username) {
            document.getElementById('usernameInput').value = result.username;
        }
        // CHECK FOR BUGS
        if(!result.bugs) { // EMPTY CASE            
            // SAVE THE INITIAL STATE OF BUG
            chrome.storage.sync.set({'bugs': []});
            setBugOuterProgress(0);
        } else { // FILLED CASE                                     
            renderBugList(result.bugs);                           
            if(result.bugs) {
                // LOADING PROGRESS BAR                        
                progressLine.set(0); 
                // CALCULATE BUGS PROGRESS                
                if(result) {
                    getBugProgress(result.bugs); 
                    setBugOuterProgress(result.bugs);
                }
            }
        }
    });   

    // SAVING USERNAME    
    document.getElementById('saveUsername').onclick = function() {
        let username = document.getElementById('usernameInput').value;        
        chrome.storage.sync.set({'username': username});
    };

    // SAVING BUG
    document.getElementById('descriptionInput').addEventListener("keyup", function(event) {
        // SAVE TRIGGER ON ENTER
        if(event.keyCode === 13 && event.target.value) {
            event.preventDefault();
            let description = document.getElementById('descriptionInput').value; // BUG DESCRIPTION FROM USER
            
            const payload = { // PAYLOAD TO THE CHROME STORAGE
                id: uuidv4(),
                description,
                resolved: false,
                created: new Date().toISOString(),
                notes: []
            }

            chrome.storage.sync.get(['bugs'], (result) => {
                let oldBugs = result.bugs
                let newBugs = [...oldBugs, payload];
                // SAVE THE NEW BUGS TO CHROME STORAGE
                chrome.storage.sync.set({'bugs': newBugs}, () => {                    
                    document.getElementById('descriptionInput').value = '';
                    setBugOuterProgress(result.bugs);
                });
            });
                        
        }
    });

    // SAVING A BUG NOTE
    document.getElementById('notesInput').addEventListener("keyup", function(event) {
        // SAVE TRIGGER ON ENTER
        if(event.keyCode === 13 && event.target.value) {
            event.preventDefault();
            let noteText = document.getElementById('notesInput').value;
            if(noteText) {
                let note = {
                    id: uuidv4(),
                    text: noteText
                };
                chrome.storage.sync.get(['bugs'], (result) => {
                    let bugs = result.bugs;
                    let currentBugId = event.target.getAttribute('data-id');
                    if(currentBugId) {
                        let bugIndex = bugs.findIndex(b => b.id.toString() === currentBugId.toString());         
                        if(bugs[bugIndex]) {
                            bugs[bugIndex].notes.push(note);
                            chrome.storage.sync.set({'bugs': bugs}, () => {
                                document.getElementById('notesInput').value = '';
                                renderBugNotes(bugs[bugIndex].notes, currentBugId);                
                            });   
                        }
                    }
                });
            }        
        }
    });

    // SAVING BUG NOTE 
    document.getElementById('saveNote').addEventListener("click", function(event) {
        let noteText = document.getElementById('notesInput').value;
        if(noteText) {
            let note = {
                id: uuidv4(),
                text: noteText
            };
            chrome.storage.sync.get(['bugs'], (result) => {
                let bugs = result.bugs;
                let currentBugId = event.target.getAttribute('data-id');
                if(currentBugId) {
                    let bugIndex = bugs.findIndex(b => b.id.toString() === currentBugId.toString());         
                    if(bugs[bugIndex]) {
                        bugs[bugIndex].notes.push(note);
                        chrome.storage.sync.set({'bugs': bugs}, () => {
                            document.getElementById('notesInput').value = '';
                            renderBugNotes(bugs[bugIndex].notes, currentBugId);                
                        });   
                    }
                }
            });
        }        
    });

    // STORAGE CLEAR
    document.getElementById('clearAccount').addEventListener("click", function(event) {        
        chrome.storage.sync.clear();
        setBugOuterProgress(0);
        window.close();
    });

    // REMOVING BUG    
    handlingABug();        

    dataListener(); // LISTENING TO ALL CHANGES IN STORAGE
});

function dataListener() {
    chrome.storage.onChanged.addListener(function(changes, namespace) {
        for(var key in changes) {            
            chrome.storage.sync.get(['username','bugs'], (result) => {
                if (key === 'username') {
                    document.getElementById('username').innerText = result.username || 'Guest';
                    if(result.username) {
                        document.getElementById('usernameInput').value = result.username;
                    }
                } else if(key === 'bugs') {
                    renderBugList(result.bugs);
                    handlingABug();
                    handleNotesRemoval(result.bugs);
                    getBugProgress(result.bugs);
                    if(result.bugs.length) {
                        setBugOuterProgress(result.bugs);
                    } else {
                        setBugOuterProgress(0);
                        progressLine.animate(0);
                    }
                    
                }
            });            
        }
    })
}

function renderBugList(bugArray) {    
    const template = (description, id, resolved, created) => {
                return `<div id="${id}" class="card mt-2 ${resolved?'bugs-active':'bugs'}" style="border-radius: 5px;">
                            <div class="card-body" style="padding: 1.2rem;">
                                <div style="display: flex; justify-content: space-between;">
                                    <div style="display: flex; align-items: center;">
                                        <input data-id="${id}" style="${resolved?'margin: 0px 10px 0px 0px;':'margin:0'}" type="checkbox" ${resolved&&'checked'} id="resolveBug">
                                        <button type="button" id="addNotes" class="close" style="padding: 1rem; ${resolved?'display: none':'display: inline-block'}"><span data-id='${id}'>&#43;</span></button>
                                        <div style="display:flex; flex-direction:column; margin-left: 5px" class="bug-text-container">                                                                                  
                                            <p style="margin: 0px 0px; font-size: 1.6rem;${resolved?'text-decoration: line-through;':''}${isURL(description)?'display:none;':''}">${description}</p>
                                            <a target="_blank" style="${isURL(description)?'':'display:none;'}${resolved?'text-decoration: line-through;color:white;':''}" href="${description}">${description}</a>
                                            <p style="font-size: 10px; margin: 2px 1px" class="text-white">${luxon.DateTime.fromISO(created).toRelative()}</p>
                                        </div>
                                    </div>                                                                      
                                    <button type="button" class="close" aria-label="Close" id="removeBug">
                                        <span data-id="${id}" aria-hidden="true">&times;</span>
                                    </button>
                                </div>
                            </div>
                        </div>`;
    }
    // LOADING ENTIRE DATA
    let bugListHTML = "";
    bugArray.map(({ id, description, resolved, created }) => {
        bugListHTML += template(description, id, resolved, created);
    });
    document.getElementById('bugList').innerHTML = bugListHTML;
}

function handlingABug() {
    chrome.storage.sync.get(['bugs'], (result) => {

        let bugElem = document.querySelectorAll('#removeBug');        
        for(let i=0; i<bugElem.length; i++) {
            bugElem[i].addEventListener("click" , function(event) {
                let selectedId = event.target.getAttribute('data-id');                      
                if(selectedId) {
                    let oldBugs = result.bugs;
                    let newBugs = oldBugs.filter(bug => bug.id.toString() !== selectedId.toString());                
                    chrome.storage.sync.set({'bugs': newBugs}, () => {                          
                        setBugOuterProgress(oldBugs.filter(bug => bug.id.toString() !== selectedId.toString()).length)
                        progressLine.animate(0);
                    });  
                }
            });
        }

        let bugElems = document.querySelectorAll('#resolveBug'); 
        for(let j=0; j<bugElems.length; j++) {
            bugElems[j].addEventListener("change" , function(event) {
                let selectedId = event.target.getAttribute('data-id');                       
                if(selectedId) {
                    let oldBugs = result.bugs;
                    let bugIndex = oldBugs.findIndex(b => b.id.toString() === selectedId.toString());
                    oldBugs[bugIndex].resolved = bugElems[j].checked;
                    chrome.storage.sync.set({'bugs': oldBugs}, () => {                    
                    });
                }
            });     
        }
        
        let noteElems = document.querySelectorAll('#addNotes');
        for (let k=0; k<noteElems.length; k++) {
            noteElems[k].addEventListener("click", function(event) {
                let selectedId = event.target.getAttribute('data-id');                       
                if(selectedId) {
                    $('#saveNote').attr('data-id', selectedId);
                    $('#notesInput').attr('data-id', selectedId);
                    $('#notesModal').modal('show');                
                    chrome.storage.sync.get(["bugs"], (result) => {
                        let bugs = result.bugs;
                        let bugIndex = bugs.findIndex(bug => bug.id.toString() === selectedId.toString());
                        if(bugs[bugIndex]) {
                            let bugNotes = bugs[bugIndex].notes;
                            if(bugNotes.length) renderBugNotes(bugNotes, selectedId);                                   
                            handleNotesRemoval(result.bugs);
                        }
                    });
                }
            });
        }            

    });
}

function renderBugNotes(data, bugId=null) {
    const notesTemplate = (description, id, bugId) => {
        return `<div id=${id} class="card mt-2 notes">
                    <div class="card-body" style="padding: 1.25rem;">
                        <div style="display: flex; justify-content: space-between;">
                            <div style="display: flex; align-items: center;" class="note-text-container">                                 
                                <p style="margin: 0px 0px;${isURL(description)?'display:none;':''}">${description}</p>
                                <a target="_blank" style="${isURL(description)?'':'display:none;'}" href="${description}">${description}</a>
                            </div>                                                                      
                            <button type="button" class="close" aria-label="Close" id="removeNote">
                                <span bug-id="${bugId}" note-id="${id}" aria-hidden="true">&times;</span>
                            </button>
                        </div>
                    </div>
                </div>`;
    }
    // LOADING ENTIRE DATA
    let notesHTML = "";
    data.map(({ id, text }) => {
        notesHTML += notesTemplate(text, id, bugId);
    });
    document.getElementById('noteList').innerHTML = notesHTML;
}

function handleNotesRemoval(bugs) {
            let closeNote = document.querySelectorAll('#removeNote');                     
                    for(let h=0; h<closeNote.length; h++) {
                        closeNote[h].onclick = function(event) {
                            let bugId = event.target.getAttribute('bug-id');
                            let noteId = event.target.getAttribute('note-id');                                                                             
                            let bugIndex = bugs.findIndex(bug => bug.id.toString() === bugId.toString());      
                            let oldNotes = bugs[bugIndex].notes;                                                    
                            bugs[bugIndex].notes = oldNotes.filter(note => note.id.toString() !== noteId.toString());                            
                            chrome.storage.sync.set({'bugs': bugs}, () => {                    
                                renderBugNotes(bugs[bugIndex].notes, bugId);                                
                            });   
                        };   
                    }
}

function isURL(url){
    var elm;
    if(url) {
        if(!elm){
            elm = document.createElement('input');
            elm.setAttribute('type', 'url');
          }
          elm.value = url;
          return elm.validity.valid;
    } else return false;
}

function getBugProgress(bugs) {    
    if(bugs && bugs.length) {        
        let totalBugs = bugs.length;
        let resolvedBugs = bugs.filter(bug => bug.resolved === true).length;        
        progressLine.animate(((resolvedBugs/totalBugs)*100)/100);  
    }
}