import React from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import DevicesScreen from '../screens/DevicesScreen';
import CustomHeader from '../components/CustomHeader';

const Drawer = createDrawerNavigator();

const CustomDrawerContent = (props: DrawerContentComponentProps) => {
  const currentRoute = props.state.routes[props.state.index].name;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF' }}>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 20 }}>
        {/* Logo and App Name */}
        <View style={styles.logoContainer}>
          <Ionicons name="leaf-outline" size={32} color="#10B981" style={{ marginRight: 10 }} />
          <Text style={styles.appName}>Smart Farm</Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          <DrawerItem
            iconName="home"
            label="Home"
            isActive={currentRoute === 'Home'}
            onPress={() => props.navigation.navigate('Home')}
          />
          <DrawerItem
            iconName="chart-line"
            iconFamily="MaterialCommunityIcons"
            label="Analytics"
            isActive={currentRoute === 'Analytics'}
            onPress={() => props.navigation.navigate('Analytics')}
          />
          <DrawerItem
            iconName="graphql"
            iconFamily="MaterialCommunityIcons"
            label="Devices"
            isActive={currentRoute === 'Devices'}
            onPress={() => props.navigation.navigate('Devices')}
          />
        </View>
      </DrawerContentScrollView>

      {/* User Profile */}
      <View style={styles.userContainer}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#FFF" />
          </View>
          <Text style={styles.username}>User name</Text>
        </View>
        <Ionicons name="chevron-up" size={20} color="#000" />
      </View>
    </View>
  );
};

const DrawerItem = ({ iconName, iconFamily = 'Ionicons', label, isActive, onPress }: any) => {
  return (
    <Pressable
      style={[styles.drawerItem, isActive && styles.activeDrawerItem]}
      onPress={onPress}
    >
      {iconFamily === 'Ionicons' ? (
        <Ionicons
          name={iconName}
          size={24}
          color={isActive ? '#000' : '#000'}
          style={styles.drawerIcon}
        />
      ) : (
        <MaterialCommunityIcons
          name={iconName}
          size={24}
          color={isActive ? '#000' : '#000'}
          style={styles.drawerIcon}
        />
      )}
      <Text style={[styles.drawerLabel, isActive && styles.activeDrawerLabel]}>
        {label}
      </Text>
    </Pressable>
  );
};

export default function DrawerNavigator() {
  const isLargeScreen = Dimensions.get('window').width >= 768;

  return (
    <Drawer.Navigator
      initialRouteName="Devices"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        header: ({ route, options }) => <CustomHeader title={options.title || route.name} />,
        drawerType: isLargeScreen ? 'permanent' : 'front',
        sceneContainerStyle: { backgroundColor: '#F3F4F6' },
        drawerStyle: {
          width: 240,
        }
      }}
    >
      <Drawer.Screen name="Home" component={HomeScreen} options={{ title: 'Home Dashboard' }} />
      <Drawer.Screen name="Analytics" component={AnalyticsScreen} options={{ title: 'Environment Analytics' }} />
      <Drawer.Screen name="Devices" component={DevicesScreen} options={{ title: 'Control & manage devices' }} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  menuContainer: {
    paddingHorizontal: 0,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  activeDrawerItem: {
    backgroundColor: '#34D399', // Bright green background
  },
  drawerIcon: {
    marginRight: 15,
  },
  drawerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  activeDrawerLabel: {
    color: '#000',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#9CA3AF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});
