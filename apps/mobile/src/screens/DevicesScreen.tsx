import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Switch, TextInput, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const API_BASE_URL = 'http://localhost:3001';

interface Device {
  id: string; // "fan", "pump", "speaker"
  name: string;
  autoMode: boolean; // Just a dummy local state for now
  power: boolean;
}

const INITIAL_DEVICES: Device[] = [
  { id: 'fan', name: 'Fan', autoMode: true, power: false },
  { id: 'pump', name: 'Pump (Water)', autoMode: true, power: false },
  { id: 'speaker', name: 'Speaker', autoMode: false, power: false },
];

const CustomSwitch = ({ value, onValueChange }: { value: boolean, onValueChange: (v: boolean) => void }) => {
  return (
    <Switch
      trackColor={{ false: '#767577', true: '#BFDBFE' }}
      thumbColor={value ? '#1D4ED8' : '#f4f3f4'}
      ios_backgroundColor="#3e3e3e"
      onValueChange={onValueChange}
      value={value}
      style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
    />
  );
};

export default function DevicesScreen() {
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [search, setSearch] = useState('');

  // Fetch initial power status
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const updatedDevices = await Promise.all(
          devices.map(async (device) => {
            try {
              const res = await fetch(`${API_BASE_URL}/telemetry/latest?type=${device.id}`);
              if (!res.ok) return device;
              const data = await res.json();
              if (data && data.raw) {
                // Determine if power is ON based on raw payload (e.g. "ON", "1")
                const isOn = data.raw === 'ON' || data.raw === '1';
                return { ...device, power: isOn };
              }
            } catch (err) {
              console.log('Error fetching status for', device.id, err);
            }
            return device;
          })
        );
        setDevices(updatedDevices);
      } catch (error) {
        console.error('Failed to fetch initial status:', error);
      }
    };
    fetchStatuses();
    
    // Optional polling for status sync
    const intervalId = setInterval(fetchStatuses, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const toggleAutoMode = (id: string) => {
    setDevices(devices.map(d => d.id === id ? { ...d, autoMode: !d.autoMode } : d));
  };

  const togglePower = async (id: string, currentValue: boolean) => {
    const newValue = !currentValue;
    const payloadValue = newValue ? 'ON' : 'OFF';

    // Optimistic UI update
    setDevices(devices.map(d => d.id === id ? { ...d, power: newValue } : d));

    try {
      const res = await fetch(`${API_BASE_URL}/commands/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value: payloadValue })
      });
      
      if (!res.ok) {
        throw new Error('Command failed');
      }
    } catch (error) {
      console.error('Toggle error:', error);
      // Revert if failed
      setDevices(devices.map(d => d.id === id ? { ...d, power: currentValue } : d));
    }
  };

  const renderHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={[styles.headerCell, { flex: 0.8 }]}>ID</Text>
      <Text style={[styles.headerCell, { flex: 2 }]}>Device name</Text>
      <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Auto mode</Text>
      <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>Power</Text>
    </View>
  );

  const renderItem = ({ item }: { item: Device }) => (
    <View style={styles.tableRow}>
      <Text style={[styles.cell, { flex: 0.8 }]}>{item.id}</Text>
      <Text style={[styles.cell, { flex: 2 }]}>{item.name}</Text>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <CustomSwitch value={item.autoMode} onValueChange={() => toggleAutoMode(item.id)} />
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <CustomSwitch value={item.power} onValueChange={() => togglePower(item.id, item.power)} />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.dropdown}>
          <Text style={styles.dropdownText}>All</Text>
          <Ionicons name="chevron-down" size={16} color="#000" />
        </View>
        <View style={styles.searchContainer}>
          <Ionicons name="options-outline" size={20} color="#9CA3AF" style={styles.filterIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            value={search}
            onChangeText={setSearch}
          />
          <View style={styles.searchButton}>
            <Ionicons name="search" size={20} color="#000" />
          </View>
        </View>
      </View>

      {/* Table */}
      <View style={styles.tableContainer}>
        {renderHeader()}
        <FlatList
          data={devices.filter(d => d.name.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()))}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 16,
    backgroundColor: '#FFF',
  },
  dropdownText: {
    marginRight: 8,
    fontSize: 14,
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFF',
    overflow: 'hidden',
  },
  filterIcon: {
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
  },
  searchButton: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 0,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#34D399',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  headerCell: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  cell: {
    fontSize: 14,
    color: '#111827',
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
  }
});
