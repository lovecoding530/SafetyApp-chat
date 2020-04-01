import React, { Component } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Image,
  Text,
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
import firebase from 'react-native-firebase'

const resourceUrl = Platform.OS === 'ios' ? RNFetchBlob.fs.dirs.DocumentDir+"/safety/" : "/storage/emulated/0/safetyDir/"

export default class home extends Component {
    constructor(props) {
        super(props)
        this.state = {
            safetyplans: '',
            maps: '',
            firstaid: '',
            loading: true,
            appState: AppState.currentState,
        }
        global.mScreen = 'Home',
        this.isMount = false
        this.isGroup = false

        this.childChangedRef = null
        this.groupChangedRef = null
    }

    alertToName = (toName) => {
        console.log('Toname = ', toName)
        let message = toName == '123group' ? 'Message from your Group' : 'Message from ' + toName
        Alert.alert(
            'Notification',
            message,
            [
                {
                    text: 'View', onPress: () => {
                        this.props.navigation.navigate({routeName:'ChatScreen', params: {name: toName}, key: 'chat'})   
                    }
                },
                {
                    text: 'Cancel',
                    onPress: () => console.log('Cancel'),
                    style: 'cancel',
                },
            ],
            {cancelable: false},
        )
    }

    async componentDidMount() {

        const notificationOpen = await firebase.notifications().getInitialNotification()
        if (notificationOpen) {
            // App was opened by a notification
            const notification = notificationOpen.notification
            notification._data.group == '1' ? name = '123group' : name = notification._data.fromname
            setTimeout(() => {
                this.props.navigation.navigate({routeName:'ChatScreen', params: {name: name}, key: 'chat'})
            }, 1000)
            
        }

        // AppState.addEventListener('change', this._handleAppStateChange)
        // firebase.notifications().removeAllDeliveredNotifications()
    
        let companycode = user.code
        let selfname = user.name
        let role = user.role
        try{
            firebase.database().ref().child(companycode+'/users/'+selfname+'/token').set(user.token).then(() => {
                console.log(user.token)
            })
        }catch {
            console.log('connection error')
        }

        let self = this
        this.childChangedRef = firebase.database().ref(companycode+'/messages/'+selfname)
        this.childChangedRef.on("child_changed", (value) => {
            if (mScreen != 'Chat') {
                let name = value.key
                self.alertToName(name);
            }
        })

        this.childChangedRef.limitToLast(1).on("child_added", (value) => {
            if (self.isMount == true && mScreen != 'Chat') {
                self.alertToName(value.key)
            }
            self.isMount = true
            console.log('Child added =', value.key);
        })

        this.groupChangedRef = firebase.database().ref(companycode+'/groupMessages/'+role)
        this.groupChangedRef.limitToLast(1).on('child_added', (value) => {
            console.log("Group_chagned", value.key)
            if (self.isGroup == true && mScreen != 'Chat') {
                self.alertToName('123group')
            }
            self.isGroup = true
        })
  
        // App in background or foreground   notification taps
        this.removeNotificationOpenedListener = firebase.notifications().onNotificationOpened((notificationOpen) => {
            // Get information about the notification that was opened
            const notification = notificationOpen.notification
            var name = ''
            notification._data.group == '1' ? name = '123group' : name = notification._data.fromname
            setTimeout(() => {
                this.props.navigation.navigate({routeName:'ChatScreen', params: {name: name}, key: 'chat'})
            }, 1000)
        })
          
        RNFetchBlob.fs.isDir(resourceUrl).then((isDir) => {
            if(!isDir){
                RNFetchBlob.fs.mkdir(resourceUrl).then(mkdir => {console.log("directory create!", mkdir)})
            }
        }) 
        let remoteMD5 = await API.readRemoteMD5()

        var url = resourceUrl + 'localCheck.md5'
        // RNFetchBlob.fs.writeFile(url, '','utf8').then(() => {
        //     console.log('Update Removed');
        // })
        
        console.log('***********', url)
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
         
        var safetyurl = resourceUrl + 'safetyplans.png'
        RNFetchBlob.fs.exists(safetyurl).then(exist => {
            var res = exist ? {'uri': "file://"+safetyurl} : Images.safetyplans
            this.setState({safetyplans: res})
        })

        var mapsurl = resourceUrl + 'maps.png'
        RNFetchBlob.fs.exists(mapsurl).then(exist => {
            var res = exist ? {'uri': "file://"+mapsurl} : Images.maps
            this.setState({maps: res})
        }) 

        var firsturl = resourceUrl + 'firstaid.png'
        RNFetchBlob.fs.exists(firsturl).then(exist => {
            var res = exist ? {'uri': "file://"+firsturl} : Images.firstaid
            this.setState({firstaid: res, loading: false})
        })
        
    }
    
    _handleAppStateChange = (nextAppState) => {
        if (
            this.state.appState.match(/inactive|background/) &&
            nextAppState === 'active'
        ) {
            console.log('App has come to the foreground!')
            firebase.notifications().removeAllDeliveredNotifications()
        }
        this.setState({appState: nextAppState})
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

    render() {
        return (
            <Container style={this.state.loading ? styles.loading: styles.container}>
                <Header prop={this.props.navigation} />
                <ScrollView>
                    <View style={{flex: 1, padding: 10, backgroundColor: '#484D53'}}>
                        <TouchableOpacity style={styles.imageView} onPress={this.subPage.bind(this, 'safetyplan.pdf')}>
                            <Image
                                style={styles.safety}
                                source={this.state.safetyplans}
                            />
                        </TouchableOpacity>
                        <BigIcon img={Images.generalInfo} title={Title.firstaid} onPress={this.subPage.bind(this, 'general.pdf')}></BigIcon>
                        <BigIcon img={this.state.maps} title={Title.maps} onPress={this.subPage.bind(this, 'map.pdf')}></BigIcon>
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
    imageView: {
        width: responsiveWidth(80),
        marginLeft: responsiveWidth(10) - 5,
        height: 180,
        marginTop: 20,
        borderWidth: 1,
        borderRadius: 10,
        borderColor: '#fff',
        backgroundColor: '#000',
        marginBottom: 5,
        alignItems: "center",
        justifyContent: "center"
    },
    safety: {
        width: responsiveWidth(80) - 60,
        height: 100,
        tintColor: '#fff',
        resizeMode: "stretch"
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