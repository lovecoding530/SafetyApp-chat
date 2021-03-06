import React, { Component, useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Image,
  View,
  ScrollView,
  Platform,
  Alert,
  AppState,
} from 'react-native';
import { Images, Title } from '../theme';
import { Container } from 'native-base';
import { responsiveWidth, responsiveHeight } from 'react-native-responsive-dimensions';
import Header from '../components/header'
import RNFetchBlob from 'rn-fetch-blob'
import API from "../components/api"
import BigIcon from '../components/bigicon'
import BottomIcon from '../components/bottomicon'
import firebase from 'react-native-firebase'
import AppData from '../components/AppData';
import Geolocation from 'react-native-geolocation-service';

const resourceUrl = Platform.OS === 'ios' ? RNFetchBlob.fs.dirs.DocumentDir+"/safety/" : "/storage/emulated/0/safetyDir/"
const PushNotification = require("react-native-push-notification");

export default class home extends Component {
    constructor(props) {
        super(props)
        this.state = {
            firstaid: '',
            loading: true,
            appState: AppState.currentState,
        }
        global.mScreen = 'Home';
        global.toName = '';
        this.item = '';

        this.childChangedRef = null
        this.groupChangedRef = null
        this.alertChangedRef = null
        this.didFocusListener = null
        this.localNotify = this.localNotify.bind(this);
        this.showAlert = this.showAlert.bind(this);
    }

    async componentDidMount() {
        await this.getMylocation()
        this.setupDatabaseListener();
        await this.getAllGroups();
        this.getMessages();
        API.firebaseTokenRefresh();
        this.prepareNotification();
        await this.fetchDocument();

        let self = this;
        this.didFocusListener =  await this.props.navigation.addListener('willFocus',
        payload => {
            console.log('Updated Home', payload);
            self.getAllGroups();
        });

        AppState.addEventListener(
            'change',
            this._handleAppStateChange
        );
    }

    _handleAppStateChange = (nextAppState) => {
        if (
          this.state.appState.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          console.log('App has come to the foreground!');
        }
        this.setState({ appState: nextAppState });
      };

    componentWillUnmount() {
        AppState.removeEventListener(
          'change',
          this._handleAppStateChange
        );
    }

    async getMylocation() {
        let position =  await API.getLocation();
        console.log("Position = ", position);
    }

    localNotify = (item) => {
        this.item = item;
        
        let message = item.isGroup ? 'Message from your Group' : 'Message from ' + item.name
        PushNotification.localNotification({
            title: "Notification", // (optional)
            message: message, // (required)
            playSound: true,
            soundName: 'default',
            number: 1,
        })
        AppData.setItem(item.id, new Date());
        setTimeout(()=>{
            PushNotification.cancelAllLocalNotifications()
        }, 3000)
    }

    showAlert = (item) => {
        this.item = item;
        let title = "EMERGENCY FROM " + item.name;
        let message = item.type + ":" + item.message;
        console.log(this.state.appState);
        if (this.state.appState != "active") {
            return;
        }
        console.log("Items is: ", item);
        PushNotification.localNotification({
            title: title, // (optional)
            message: message, // (required)
            playSound: true,
            soundName: 'alert.mp3',
            number: 1,
        })
        // setTimeout(()=>{
        //     PushNotification.cancelAllLocalNotifications()
        // }, 10000)
    }

    async getMessages() {
        firebase.database().ref().child(user.code + '/messages/' + user.name).once('value')
        .then((snapshots) => {
            snapshots.forEach(function(snapshot) {
                var date = new Date(2000,1,1);
                var key = snapshot.key;
                snapshot.forEach(function(daSnap) {
                    if (new Date(daSnap.val().createdAt) > date) {
                        date = new Date(daSnap.val().createdAt);
                    }
                }) 
                AppData.setItem(key, date);
            });
        })
        firebase.database().ref().child(user.code + '/groupMessages/').once('value')
        .then((snapshots) => {
            snapshots.forEach(function(snapshot) {
                var date = new Date(2000,1,1);
                var key = snapshot.key;
                snapshot.forEach(function(daSnap) {
                    if (new Date(daSnap.val().createdAt) > date) {
                        date = new Date(daSnap.val().createdAt);
                    }
                }) 
                AppData.setItem(key, date);
            });
        })
    }

    async getAllGroups() {
        firebase.database().ref().child(user.code + '/users').once('value')
        .then((snapshots) => {
            var mUsers = []
            snapshots.forEach(function(snapshot) {
                var mUser = {
                    id: snapshot.key,
                    name: snapshot.key,
                    role: snapshot.val().role,
                    token: snapshot.val().token,
                    image: snapshot.val().image,
                    isGroup: false,
                }
                mUsers.push(mUser)
            })
            AppData.setItem('Users', mUsers);
        })
        firebase.database().ref().child(user.code + '/groups').once('value')
        .then((snapshots) => {
            var mGroups = [];
            snapshots.forEach(function(snapshot) {
                var id = snapshot.key;
                var name = snapshot.val()['title'];
                var users = snapshot.val()['users'];
                var image = snapshot.val()['image'];
                if (users.includes(user.name)) {
                    var group = {
                        id,
                        name,
                        role: 'GROUP',
                        users,
                        isGroup: true,
                        image,
                    }
                    mGroups.push(group)
                }
            })
            AppData.setItem('Groups', mGroups);

        })
    }

    setupDatabaseListener() {
        let self = this
        this.childChangedRef = firebase.database().ref(user.code + '/messages/' + user.name)
        this.childChangedRef.on("child_changed", (value) => {
            let name = value.key;
            if (mScreen == 'Chat' && toName == name) return;
            let item = {
                id: name,
                name: name,
                isGroup: false,
            }
            self.localNotify(item);
        })

        this.groupChangedRef = firebase.database().ref(user.code + '/groupMessages/')
        this.groupChangedRef.on("child_changed", (value) => {
            if (toName == value.key && mScreen == 'Chat') return
            let item = {
                id: value.key,
                name: value.key,
                isGroup: true,
            }
            self.localNotify(item);
        })

        this.alertChangedRef = firebase.database().ref(user.code + '/alerts/');
        this.alertChangedRef.on("child_changed", (value) => {
            let val = value.val();
            // let itemId = val.seats[val.seats.length - 1]
            
            let key = Object.keys(val)[0];
            let keys = Object.keys(val);
            for (temp in keys) {
                if (val[key].timestamp < val[keys[temp]].timestamp) {
                    key = keys[temp];
                }
            }
            let item1 = val[key];
            console.log("Alert value", item1);
            if (item1.user == user.name) return;
            if ((user.role == 'administrator' || user.role == 'manager') && (item1.role == 'administrator' || item1.role == 'manager')) return;
            if (!(user.role == 'administrator' || user.role == 'manager') && !(item1.role == 'administrator' || item1.role == 'manager')) return;
            let item = {
                id: item1.user,
                name: item1.user,
                message: item1.message,
                isAdmin: item1.isAdmin,
                type: item1.type,
                alert: true,
                lat: item1.lat,
                lon: item1.lon,
            }
            self.showAlert(item);
        })
    }

    async prepareNotification() {
        let self = this;
        PushNotification.configure({
            onRegister: function(token) {
            },
            onNotification: function(notification) {
                console.log("Noti item", self.item);
                if (self.item != '' && Platform.OS === 'android') {
                    
                    if (self.item.alert == true) {
                        if (self.item.lat == undefined) {
                            let title = "EMERGENCY FROM " + self.item.name;
                            let message = self.item.type + ":" + self.item.message;
                            Alert.alert(title, message);
                            return;
                        }
                        self.props.navigation.navigate({routeName:'MapScreen', params: {item: self.item}, key: 'map'})
                        return;
                    }
                    self.props.navigation.navigate({routeName:'ChatScreen', params: {item: self.item}, key: 'chat'})
                }
            },
            senderID: "532288277681",
            permissions: {
                alert: true,
                badge: true,
                sound: true
            },
            popInitialNotification: true,
            requestPermissions: Platform.OS === 'ios'
        });

        const notificationOpen = await firebase.notifications().getInitialNotification()
        if (notificationOpen) {
            // App was opened by a notification
            const notification = notificationOpen.notification
            toName = notification._data.fromname
            let isAlert = notification._data.alert;
            console.log("Get noti", notification._data);
            if (isAlert == "true") {
                // console.log;
                setTimeout(() => {
                    self.props.navigation.navigate({routeName:'MapScreen', params: {item: notification._data}, key: 'map'})
                }, 100)    
                return true;
            }
            self.item = {
                id: toName,
                name: toName,
                isGroup: notification._data.group == '1'
            }
            setTimeout(() => {
                this.props.navigation.navigate({routeName:'ChatScreen', params: {item: self.item}, key: 'chat'})
            }, 100)
        }

        // App in background or foreground notification taps
        this.removeNotificationOpenedListener = firebase.notifications().onNotificationOpened((notificationSnap) => {
            // Get information about the notification that was opened
            console.log("NOTIFICATION OPENED:", self.item);
            if (self.item.alert == true) {
                if (self.item.lat == undefined) {
                    let title = "EMERGENCY FROM " + self.item.name;
                    let message = self.item.type + ":" + self.item.message;
                    Alert.alert(title, message);
                    return;
                }
                self.props.navigation.navigate({routeName:'MapScreen', params: {item: self.item}, key: 'map'})
                return;
            }
            if (self.item != '') {
                self.props.navigation.navigate({routeName:'ChatScreen', params: {item: self.item}, key: 'chat'})
            }
        })
    }

    subPage(text) {
        this.props.navigation.navigate('SubPageScreen', {'aspect': text})
    }

    pdfDisplay(text) {
        this.props.navigation.navigate('pdfDisplayScreen', {'title': text})
    }

    phonetree() {
        this.props.navigation.navigate('PhoneTreeScreen')
    }

    onSubAlert() {
        this.props.navigation.navigate('SubalertScreen');
    }

    onAlert() {
        this.props.navigation.navigate('EmergencyScreen');
    }

    async fetchDocument() {
        RNFetchBlob.fs.isDir(resourceUrl).then((isDir) => {
            if(!isDir){
                RNFetchBlob.fs.mkdir(resourceUrl).then(mkdir => {console.log("directory create!", mkdir)})
            }
        }) 
        let remoteMD5 = await API.readRemoteMD5()
        var url = resourceUrl + 'localCheck.md5'

        RNFetchBlob.fs.exists(url).then((exist) => {
            console.log('md5 file exist', exist)
            if(exist) {
                RNFetchBlob.fs.readFile(url, 'utf8').then((localMD5) => { 
                    if(localMD5 == remoteMD5) {
                        console.log("Correct Sync!", localMD5)
                    } else {
                        RNFetchBlob.fs.unlink(resourceUrl).then(() => {
                            RNFetchBlob.fs.mkdir(resourceUrl).then(() =>{
                                RNFetchBlob.fs.writeFile(url, remoteMD5,'utf8').then(() => {
                                    API.updateFiles().then(() => {console.log('Update Success!')})
                                })
                            })
                        })
                    }
                })
            } else {
                RNFetchBlob.fs.unlink(resourceUrl).then(() => {
                    RNFetchBlob.fs.mkdir(resourceUrl).then(() => {
                        RNFetchBlob.fs.createFile(url, remoteMD5, 'utf8').then(() => {
                            API.updateFiles().then(() => {console.log('Update Success!')})
                        })
                    })
                })
            }
        })

        var firsturl = resourceUrl + 'firstaid.png'
        RNFetchBlob.fs.exists(firsturl).then(exist => {
            var res = exist ? {'uri': "file://"+firsturl} : Images.firstaid
            this.setState({firstaid: res, loading: false})
        })
    }

    render() {
        return (
            <Container style={this.state.loading ? styles.loading: styles.container}>
                <Header prop={this.props.navigation} />
                <ScrollView>
                    <View style={{flex: 1, padding: 10, backgroundColor: '#484D53'}}>                   
                        <BottomIcon img={Images.emergencycutoffs} onLongPress={this.onAlert.bind(this)} title={Title.emergency} onPress={this.onSubAlert.bind(this)}></BottomIcon>
                        <BigIcon img={Images.generalInfo} title={Title.firstaid} onPress={this.subPage.bind(this, 'general.pdf')}></BigIcon>
                        <BigIcon img={Images.safetychat} title={Title.phonetree} onPress={this.phonetree.bind(this)}></BigIcon>
                    </View>
                </ScrollView>
            </Container>
        )
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'stretch',
        backgroundColor: '#484D53'
    },
    loading: {
        display: "none"
    },
    row:{
        marginLeft: responsiveWidth(10)-25,
        marginTop: 20,
        height: responsiveHeight(30)-40,
    },
    button: {
        marginLeft: 10,
        tintColor: '#53adcb',
        overlayColor: '#000',
        borderRadius: 10,
        borderWidth: 1,
        width: responsiveWidth(40)-5,
        height: responsiveHeight(30)-40,
        resizeMode: "stretch"
    },
    dialog: {
        alignItems: "center",
        top: responsiveHeight(50),
        left: responsiveWidth(50)-40,
        zIndex: 100,
        position: 'absolute'
    },
    dialogNone: {
        display: "none"
    },
});