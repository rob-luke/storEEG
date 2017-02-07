const ipcRenderer = require('electron').ipcRenderer
const localforage = require('localforage')
const dragula = require('dragula')
const uuid = require('uuid/v4')
const remote = require('electron').remote
const {BrowserWindow, dialog} = require('electron').remote
const fs = require('fs')
const path = require('path');
const url = require('url');
const jsonfile = require('jsonfile')
jsonfile.spaces = 2;
const studyFolder = path.join(__dirname, '..', 'studies');
var currentStudy = null;
var studyInProgress = 0;

const links = document.querySelectorAll('link[rel="import"]')
// Import and add each page to the DOM
Array.prototype.forEach.call(links, function (link) {
	let template = link.import.querySelector('.section-template')
	let clone = document.importNode(template.content, true)
	document.querySelector('#main-area').appendChild(clone)
})

// Function definitions

function exitProgram() {
	ipcRenderer.send('exit-clicked');
}

function objToArray(toConvert) {
	// Converts the object that is passed to an array of the values of all of its properties
	var temp = [];
	for(var a in toConvert) {
		temp.push(toConvert[a]);
	}

	return temp
}

function arrayToObj(toConvert) {
	// Converts passed array to an obj
	// Property names are the UUIDs of the array elements
	// Property values are the values of the array elements

	var temp = {};
	if(toConvert.length==0){
		return []
	}
	if(toConvert[0].hasOwnProperty('UUID')) {
		for(var i in toConvert) {
				temp[toConvert[i].UUID] = toConvert[i];
		}
	}
	else {
		temp = toConvert;
	}
	return temp
}

function openAddRecordingWindow(currentRecording) {
		var recordingWindow = new BrowserWindow({
			width: 800,
			height: 600,
			id: 'recordingWindow',
			show: false,
			parent: remote.getCurrentWindow(),
			modal: true
		})
		recordingWindow.loadURL(url.format({
			pathname: path.join(__dirname, 'addRecordingWindow.html'),
			protocol: 'file:',
			slashes: true
		}))
		recordingWindow.once('ready-to-show', () => {
			ipcRenderer.send('created-recording-window', currentRecording, currentStudy)
			recordingWindow.show()
		})
}

function getDirectories (srcpath) {
  return fs.readdirSync(srcpath)
    .filter(file => fs.statSync(path.join(srcpath, file)).isDirectory())
}

function writeCurrentStudy(callback) {
	// Writes the current study to a JSON file under /studies/'filename' after converting objects to arrays
	fs.mkdirSync(path.join(studyFolder, currentStudy));

	localforage.getItem(currentStudy).then((data) => {
		var UUID = data.UUID;
		var title = data.studyTitle;
		var description = data.studyDescription;
		for(var i in data) {
			data[i] = objToArray(data[i]);
		}
		data.UUID = UUID;
		data.studyTitle = title;
		data.studyDescription = description;
		jsonfile.writeFile(path.join(studyFolder, currentStudy, 'studyDescription.json'), data, (err) => {
			console.log(err);
			if(callback){callback();}
		})
	})
}

function resetCurrentIndicators() {
	currentStudy = null;
	studyInProgress = 0;
}

function writeStudy(filename, studyName) {

	fs.mkdirSync(path.join(studyFolder, filename));

	localforage.getItem(studyName).then((data) => {
		var UUID = data.UUID;
		var title = data.studyTitle;
		var description = data.studyDescription;
		for(var i in data) {
			data[i] = objToArray(data[i]);
		}
		data.UUID = UUID;
		data.studyTitle = title;
		data.studyDescription = description;
		jsonfile.writeFile(path.join(studyFolder, filename, 'studyDescription.json'), data, (err) => {
			console.log(err);
		})
	})
}

function readStudy(filename) {
	jsonfile.readFile(path.join(studyFolder, filename, 'studyDescription.json'), (err, data) => {
		for(var i in data) {
			data[i] = arrayToObj(data[i]);
		}
		localforage.setItem(data.studyTitle, data, (value) => {
			successfulAddAlert();
		})
	})
}

function writeDB() {
	// Writes all files in the localforage DB to JSON under /studies/
	localforage.iterate(function(key, data, iterationNumber) {
		writeStudy(key, key);
	}).catch((err) => {
		console.log(err);
	})
}

function refreshDB() {
	// Clears localforage and repopulates from /studies/ folder
	localforage.clear()

	var studies = getDirectories(studyFolder);
	for(var i in studies) {
		readStudy(studies[i]);
	}
}

function hideAllSectionsAndDeselectButtons() {
	$("#main-area > div").hide() // Hide all sections

	$(".nav-pills > li").removeClass("active") // De-activate all nav buttons
}

const handleFormSubmit = event => {
	event.preventDefault()

	var data = formToJSON(event.currentTarget.elements);
	data.UUID = uuid();

	localforage.getItem(currentStudy, (err, value) => {
		var temp = value[event.currentTarget.name];
		temp[data.UUID] = data;
		value[event.currentTarget.name] = temp;
		localforage.setItem(currentStudy, value).then(function () {
			event.currentTarget.reset();
			updateObjectDisplays(event);
		});
	});
}

function printCurrent() {
	localforage.getItem(currentStudy, (err, value) => {
		console.log(JSON.stringify(value, null, "  "));
	})
}

const formToJSON = elements => [].reduce.call(elements, (data, element) => {
	if(isValidEntry(element)) {
		data[element.name] = element.value;
	}
	return data;
}, {});

function isValidEntry(element) {
	return element.name && element.value;
};

function updateObjectDisplays(event) {
	var currentForm = event.currentTarget.id.slice(4);

	localforage.getItem(currentStudy).then(function (value){
		var currentForm = event.currentTarget.name;
		value = value[currentForm];
		$('#' + currentForm + 'Drag').empty()
		for(var i in value) {
			createDragObject(value[i], currentForm);
		}
	});
}

function createDragObject(item, where) {

	$('<div/>', {
		'class': 'drag-item',
		'text': where.charAt(0).toUpperCase() + where.slice(1, where.length-1) + ' ID: ' + item.label,
		'data-UUID': item.UUID
	}).appendTo($('#' + where + 'Drag'));

}

function initializeDragging(){
	const drakes = {
		'subjects': dragula([$("#subjectsDrag")[0]], {removeOnSpill: true}),
		'stimuli': dragula([$("#stimuliDrag")[0]], {removeOnSpill: true}),
		'recordingParameterSets': dragula([$("#recordingParameterSetsDrag")[0]], {removeOnSpill: true}),
		'events': dragula([$("#eventsDrag")[0]], {removeOnSpill: true})
	};

	for(var key in drakes) {
		drakes[key].on('remove', (el, container, source) => {
			var name = container.id;
			name = name.slice(0, container.id.length-4);
			localforage.getItem(currentStudy, (err, value) => {
				delete value[name][el.dataset.uuid];
				localforage.setItem(currentStudy, value).then(function () {console.log('success!');});
			});
		});
	}
	return drakes
}

function successfulAddAlert() {
	$("#main-area").prepend('<div class="alert alert-success alert-dismissible fade in" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close" name="button"><span aria-hidden="true">x</span></button><strong>Success!</strong> Study has been added successfully to the repository! </div>')
}

function alreadyExistsAlert() {
	$("#main-area").prepend('<div class="alert alert-danger alert-dismissible fade in" role="alert"><button type="button" class="close" data-dismiss="alert" aria-label="Close" name="button"><span aria-hidden="true">x</span></button><strong>Error!</strong> A Study with that name already exists! </div>')
}

function resetDraggers() {

	var default1 = '<div class="drag-item">Add some items to the left!</div><div class="drag-item">Drag & drop items outside this box to delete them.</div>';

	$('.drag-container').html(default1)

}

// Event Handlers

document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault()
}

$(".data-entry").on('submit', handleFormSubmit);

$(".nav-link").on('click', function (event) {
	hideAllSectionsAndDeselectButtons()

	$('#' + $(this).data('section')).show()
	$(this).parent().addClass("active")
});

$(".file-adder").on('click', function (event) {
	event.preventDefault();
	// event.stopPropagation();
	//this.parentNode.value =
	var filePath = dialog.showOpenDialog({properties: ['openFile']});
	$(this).prop('value', filePath);
	filePath = filePath[0].replace(/^.*[\\\/]/, '');
	$(this).toggleClass('btn-primary btn-success')
	$(this).prop('innerHTML', filePath)
});

$('.data-entry').on('reset', function (event) {
	$("[name='"+event.currentTarget.name+"'] > .form-group > .file-adder").toggleClass('btn-primary btn-success');
	$("[name='"+event.currentTarget.name+"'] > .form-group > .file-adder").prop('innerHTML', 'Add File');
})

$("#initial-add-form").on('submit', function (event) {
	event.preventDefault();

	studyInProgress = 1;
	resetDraggers(draggers)
	var data = formToJSON(event.currentTarget.elements);
	data.UUID = uuid();
	$("#initial-add-form")[0].reset()
	localforage.getItem(data.studyTitle, (err, study) => {
		if(study) {
			alreadyExistsAlert();
		}
		else {
			data.subjects = {};
			data.stimuli = {};
			data.recordingParameterSets = {};
			data.recordings = {};
			data.events = {};
			data.publications = {};
			data.experimenters = {};
			data.license = {};
			data.contacts = {};

			localforage.setItem(data.studyTitle, data, (value) => {
				$("#add-new-section").hide();
				$("#main-add-section").show();
			});
			currentStudy = data.studyTitle;
		}
	});

});

$("#import-study-button").on('click', function (event) {
	var filePath = dialog.showOpenDialog({properties: ['openFile']});
	readStudy(filePath[0]);
})

$("#add-new-study-button").on('click', function (event) {
	$("#add-section").hide();
	$("#add-new-section").show();
})

$(".btn-recording-drag").on('click', (event) => {
	var currentRecording = {};
	currentRecording.fileLocation = dialog.showOpenDialog({properties: ['openFile']});
	currentRecording.fileLocation = currentRecording.fileLocation[0];
	currentRecording.eventUUIDs = [];
	currentRecording.subjectUUID = "";
	currentRecording.recordingParameterSetUUID = "";
	currentRecording.label = "";
	currentRecording.UUID = uuid();

	openAddRecordingWindow(currentRecording);
})

$(".btn-recording-drag-wrapper").on('dragover', (event) => {
	$(".btn-recording-drag").addClass('btn-success');
	$(".btn-recording-drag").removeClass('btn-primary');
})

$(".btn-recording-drag-wrapper").on('dragleave', (event) => {
	$(".btn-recording-drag").removeClass('btn-success');
	$(".btn-recording-drag").addClass('btn-primary');
})

$(".btn-recording-drag-wrapper").on('drop', (event) => {
	event.preventDefault();
	var currentRecording = {};
	currentRecording.fileLocation = event.originalEvent.dataTransfer.files[0].path;
	currentRecording.eventUUIDs = [];
	currentRecording.subjectUUID = "";
	currentRecording.recordingParameterSetUUID = "";
	currentRecording.label = "";
	currentRecording.UUID = uuid();
	$(".btn-recording-drag").removeClass('btn-success');
	$(".btn-recording-drag").addClass('btn-primary');
	openAddRecordingWindow(currentRecording);
})

$("#submitStudyButton").on('click', (event) => {
	writeCurrentStudy(resetCurrentIndicators)
	$('#home-button').click()
	successfulAddAlert()
})

$('.drag-item').on('click', (event) => {
	alert('it works!')
})

const draggers = initializeDragging();

//$("#home-section").show()

/*
document.body.ondrop = (ev) => {
  console.log(ev.dataTransfer.files[0].path)
  ev.preventDefault()
}

$("#stim-file-selector").on('drop', function (ev) {
	  ev.preventDefault();
		ev.stopPropagation();
		console.log(ev)
		console.log(ev.originalEvent.dataTransfer);
		console.log(ev.originalEvent.dataTransfer.files[0].path)
});
*/