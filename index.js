/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { smsReceivedTask } from './src/ingest/smsIngest';

AppRegistry.registerComponent(appName, () => App);
// Started by native/android/.../SmsReceiver.kt for each new bank SMS.
AppRegistry.registerHeadlessTask('SmsReceived', () => smsReceivedTask);
