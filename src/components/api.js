import NetInfo from "@react-native-community/netinfo"
import AppData from "./AppData"
import Base64 from 'Base64'
import RNFetchBlob from 'rn-fetch-blob'
import {Platform, Alert} from 'react-native'

const resourceUrl = Platform.OS === 'ios' ? RNFetchBlob.fs.dirs.DocumentDir+ "/safety/" : "/storage/emulated/0/safetyDir/"

async function getConnection() {
    
    let status = await NetInfo.fetch()
    return status.isConnected    
}

async function checkCode() {
    return await AppData.getItem('Companycode')
}

async function setCode(code) {
    await AppData.setItem("Companycode",code)
}

async function setUrl() {
    var code = await AppData.getItem('Companycode')
    var url = "https://"+code+".myspapp.com/";
    await AppData.setItem("companyUrl", url);
}

async function getUrl() {
    return await AppData.getItem('companyUrl')
}

async function login(name, password) {
    console.log("*****login*********")
    var url = await getUrl() + "wp-json/aam/v1/authenticate"
    try {
        let response = await fetch(url, {
            method: 'POST',
            headers:{
                'Content-Type': 'application/json',
                'accept': 'application/json',
            },
            body:JSON.stringify({
                username: name,
                password: password
            })
        });
        let responseJson = await response.json() 
        
        console.log("-------------------roles-----------------------", responseJson.user)
        if(responseJson.token != null) {
            await AppData.setItem('username', name)
            await AppData.setItem('password', password)
            await AppData.setItem('token', responseJson.token)
            await AppData.setItem('role', responseJson.user.roles[0])
            return true
        } else {
            return false
        }
    } catch (error) {
        return false
    }
}

async function readRemoteMD5() {
    var username = await AppData.getItem('username')
    var password = await AppData.getItem('password')
    var token = Base64.btoa(username+":"+password)
    var url = await getUrl() + "wp-content/uploads/mdocs/remoteCheck.md5"
    var response = RNFetchBlob.fetch('GET', url, {
        Authorization: 'Basic ' + token
    })
    .then( res=> {
        return res.data
    })
    return response
}

async function readManifest() {
    var username = await AppData.getItem('username')
    var password = await AppData.getItem('password')
    var token = Base64.btoa(username+":"+password)
    var url = await getUrl() + "wp-content/uploads/mdocs/manifest"
    var response = RNFetchBlob.fetch('GET', url, {
        Authorization: 'Basic ' + token
    })
    .then( res=> {
        return res.data
    })
    return response
}

async function updateFiles() {
    var username = await AppData.getItem('username')
    var password = await AppData.getItem('password')
    var token = Base64.btoa(username+":"+password)
    var baseUrl = await getUrl()
    var response = await readManifest()
    let localUrl = resourceUrl
    //await RNFetchBlob.fs.unlink(localUrl)
    var tempList = response.split("\n")
    var fileList = []
    tempList.forEach( item => {
        if(item != '') fileList.push(item)
    })
    fileList.forEach( item => {
        var url = baseUrl +  "wp-content/uploads/mdocs/" + item
        RNFetchBlob.fetch('GET', url, {
            Authorization: 'Basic '+ token
        })
        .then( res => {
            var url = localUrl + item.toLowerCase()
            RNFetchBlob.fs.writeFile(url, res.data, 'base64')
        })
    })

}

async function sendNotification(to, title, body, data) {
    var SERVER_KEY = 'AIzaSyCEQ2MlHaO3fr24PbeIX_SQs5X-nhPEHzQ'
    let url = 'https://fcm.googleapis.com/fcm/send'
    var headers = {
        'Authorization': 'key=' + SERVER_KEY,
        'Content-Type': 'application/json'
    }
    var body = JSON.stringify({
        to: to,
        notification: {
            title: title,
            body: body,
            sound: 'default',
            badge: 0
        },
        data: data
    })
    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });
        let responseJson = await response.json()         
        return responseJson
    } catch (error) {
        return null
    }
}

export default {
    getConnection,
    setCode,
    checkCode,
    setUrl,
    getUrl,
    login,
    readRemoteMD5,
    updateFiles,
    readManifest,
    sendNotification,
}