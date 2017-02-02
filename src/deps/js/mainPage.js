const ipcRenderer = require('electron').ipcRenderer
const localforage = require('localforage')
const dragula = require('dragula')
const uuid = require('uuid/v4')
const {dialog} = require('electron').remote
const fs = require('fs')
const jsonfile = require('jsonfile')
jsonfile.spaces = 3;
var currentStudy = null

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
}

// Event Handlers

$(".data-entry").on('submit', handleFormSubmit);

$('.data-entry').on('reset', function (event) {
	$("[name='"+event.currentTarget.name+"'] > .form-group > .file-adder").toggleClass('btn-primary btn-success');
	$("[name='"+event.currentTarget.name+"'] > .form-group > .file-adder").prop('innerHTML', 'Add File');
})

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

$("#initial-add-form").on('submit', function (event) {
	event.preventDefault();

	var data = formToJSON(event.currentTarget.elements);
	data.UUID = uuid();
	$("#initial-add-form")[0].reset()
	localforage.getItem(data.studyTitle, (err, study) => {
		if(study) {
			alert('Study already exists!');
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
				$("#add-section").hide();
				$("#main-add-section").show();
			});
			currentStudy = data.studyTitle;
		}
	});

});

// Data export and import

function writeCurrentStudyToDisk() {
	//Write current study to disk under /studies/
	localforage.getItem(currentStudy).then(function (err, data) {

	})
}

function writeAllStudyToDisk() {
	// Write all studies contained in localforage under /studies/
	// This action is performed on shutdown to preserve data.

}

function populateDB() {
	// Populate the database with all studies found under /studies/
	// This is done because DB is cleared on startup and needs to be re-populated

}

function refreshDB() {
	// Clears localforage and refreshes based on studies contained in /studies/
	localforage.clear();
	populateDB();
}

$("#home-table").bootstrapTable({
	columns: [{
		field: 'studyTitle',
		title: 'Title'
	},
	{
		field: 'numSubs',
		title: 'Number of Subjects'
	},
	{
		field: 'numRecs',
		title: 'Number of Recordings'
	}],
	data: [{
		studyTitle: 'Test Study 1',
		numSubs: 25,
		numRecs: 50
	},
	{
		studyTitle: 'Test Study 2',
		numSubs: 40,
		numRecs: 80
	}]
});

$("#home-section").show()

initializeDragging();

/*
document.ondragover = document.ondrop = (ev) => {
  ev.preventDefault()
}

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
