var express = require('express')
var logger = require('morgan')
var bodyParser = require('body-parser')
var fs = require("fs")
// require("@tensorflow/tfjs-node");
// const tf = require("@tensorflow/tfjs");
const nodeFetch = require("node-fetch");
var canvas = require('canvas')
const faceapi = require("face-api.js");
var admin = require('firebase-admin')

// This account is no longer valid
var serviceAccount = require('./firbase_key/faceattendance-b513a-firebase-adminsdk-5ztpx-9eb3251d81.json')

var firebaseAdmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://faceattendance-b513a.firebaseio.com/'
})

var db = firebaseAdmin.database()

// Create instance of express app
var app = express()

app.set('view engine', 'ejs')

// We also want to send css, images, and other static files
app.use(express.static('views'))
app.set('views', __dirname + '/views')

// Give the server access to the user input
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

app.use(logger('dev'))

app.get('/', (req,res) => {
    res.render('home.ejs')
})


const MODELS_URL = "./weights"

const width = 640;
const height = 480;

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromDisk(MODELS_URL),
  faceapi.nets.faceLandmark68Net.loadFromDisk(MODELS_URL),
  faceapi.nets.faceRecognitionNet.loadFromDisk(MODELS_URL),
  faceapi.nets.faceExpressionNet.loadFromDisk(MODELS_URL),
  faceapi.nets.ssdMobilenetv1.loadFromDisk(MODELS_URL)
]);


console.log(faceapi.nets)

const jsdom = require("jsdom");
const { JSDOM } = jsdom;
global.window = new JSDOM(`<!DOCTYPE html><img id="myImg" src="" />`, { resources: "usable", url: "file:///" + __dirname + "/" }).window;
global.document = window.document;
global.HTMLElement = window.HTMLElement;


faceapi.env.monkeyPatch({ 
    fetch: nodeFetch,
    Canvas: window.HTMLCanvasElement,
    Image: window.HTMLImageElement,
    ImageData: canvas.ImageData,
    createCanvasElement: () => document.createElement('canvas'),
    createImageElement: () => document.createElement('img')
 });


async function getdescriptors_single(query_image="./views/reclamation.jpeg"){
    document.getElementById('myImg').src = query_image;
    image = document.getElementById('myImg');
    const detections = await faceapi.detectSingleFace(image).withFaceLandmarks().withFaceDescriptor()
    return detections;
}

async function getdescriptors(query_image="./views/reclamation.jpeg"){
    document.getElementById('myImg').src = query_image;
    image = document.getElementById('myImg');
    const detections = await faceapi.detectAllFaces(image).withFaceLandmarks().withFaceExpressions()
    return detections;
}


/*********************************************************
 * 
 *                 REGISTRATION
 * 
 *********************************************************/

app.post("/registration", async (req, res)=>{
    // var query_image = "./views/reclamation.jpeg"

    var students = db.collection('students').doc('details');
    students.set({
        "rno" : req.rno,
        "descriptor" : getdescriptors_single(req.files.Image)
      })

    res.json({"status": "Student Added to the database!!"})
})



/*********************************************************
 * 
 *                SINGLE STUDENT DETECTION
 * 
 *********************************************************/


app.post("/processing_single", async (req, res)=>{

    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6)
    const detections = getdescriptors_single(req.files.classImage)
    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor))

    var students = db.collection('students').doc('');
    descriptors = getdescriptors(req.files.Image)
    // students.set({
    //     "rno" : req.rno,
    //     "descriptor" : descriptors
    //   })

    res.json({"status": "Successful!!","descriptors": descriptors})
})


/*********************************************************
 * 
 *                 ATTENDANCE
 * 
 *********************************************************/

app.post("/processing_group", async (req, res)=>{

    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6)
    const detections = getdescriptors(req.files.classImage)
    const results = detections.map(d => faceMatcher.findBestMatch(d.descriptor))

    var attendance = db.collection('attendance').doc('');
    attendance.set({
        "rno" : req.rno,
        "descriptor" : getdescriptors(req.files.Image)
      })

    res.json({"status": "attendance successfull!!", "Attendance": results})
})


var port = process.env.PORT || 8080

app.listen(port, function(){
    console.log('App running on port ' + port)
})