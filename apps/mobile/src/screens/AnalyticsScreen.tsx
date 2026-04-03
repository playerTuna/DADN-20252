import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const API_BASE_URL = 'http://localhost:3001';

const TABS = [
  { label: 'Temperature', value: 'temp' },
  { label: 'Air Humidity', value: 'air_humidity' },
  { label: 'Soil Humidity', value: 'soil_humidity' },
  { label: 'Light Intensity', value: 'light' }
];

export default function AnalyticsScreen() {
  const [activeTab, setActiveTab] = useState(TABS[0].value);
  const [chartData, setChartData] = useState<number[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/telemetry?type=${activeTab}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        
        if (isMounted) {
          if (Array.isArray(data) && data.length > 0) {
            // API returns sorting newest first, so we reverse it for chart (left to right = old to new)
            // Let's take the latest 12 records
            const recentData = data.slice(0, 12).reverse();
            
            const newLabels = recentData.map((item: any, index: number) => {
               const date = new Date(item.receivedAt);
               return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
            });
            const newValues = recentData.map((item: any) => item.numericValue || 0);

            setLabels(newLabels);
            setChartData(newValues);
          } else {
            setLabels(['0']);
            setChartData([0]);
          }
        }
      } catch (error) {
        console.log('Error fetching telemetry:', error);
        if (isMounted) {
           // Fallback fake data if backend is not running or failed
           setLabels(['0', '1', '2', '3', '4', '5']);
           setChartData([20, 22, 23, 21, 25, 24]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    
    // Auto refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  const chartConfig = {
    backgroundGradientFrom: '#FFF',
    backgroundGradientTo: '#FFF',
    color: (opacity = 1) => `rgba(180, 160, 100, ${opacity})`, 
    strokeWidth: 2, 
    barPercentage: 0.5,
    useShadowColorFromDataset: false,
    propsForBackgroundLines: {
      strokeDasharray: '', 
      stroke: '#E5E7EB',
    },
    propsForLabels: {
      fontSize: 10,
      fill: '#6B7280',
    }
  };

  const data = {
    labels: labels.length > 0 ? labels : ['0'],
    datasets: [
      {
        data: chartData.length > 0 ? chartData : [0],
        color: (opacity = 1) => `rgba(200, 180, 100, ${opacity})`,
        strokeWidth: 2
      }
    ],
  };

  const chartWidth = Dimensions.get('window').width - 240 - 48 - 40; 
  const actualWidth = chartWidth > 400 ? chartWidth : 600;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.tabsContainer}>
          {TABS.map((tab, index) => (
            <Pressable
              key={tab.value}
              style={[
                styles.tab,
                activeTab === tab.value && styles.activeTab,
                index === 0 && styles.firstTab,
                index === TABS.length - 1 && styles.lastTab
              ]}
              onPress={() => setActiveTab(tab.value)}
            >
              <Text style={[styles.tabText, activeTab === tab.value && styles.activeTabText]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.chartContainer}>
           {loading && chartData.length === 0 ? (
             <ActivityIndicator size="large" color="#22C55E" />
           ) : (
             <LineChart
              data={data}
              width={actualWidth}
              height={300}
              chartConfig={chartConfig}
              bezier={false} 
              withDots={false} 
              withInnerLines={true}
              withOuterLines={true}
              withVerticalLines={true}
              withHorizontalLines={true}
              yAxisSuffix=""
              yAxisInterval={1} 
              segments={4}
              style={{
                marginVertical: 8,
                marginLeft: -20
              }}
            />
           )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 0,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    padding: 32,
    minHeight: 500,
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 40,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRightWidth: 0,
  },
  firstTab: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  lastTab: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    borderRightWidth: 1,
  },
  activeTab: {
    backgroundColor: '#22C55E', // Green
    borderColor: '#22C55E',
    borderRightWidth: 1,
  },
  tabText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#000',
    fontWeight: '600',
  },
  chartContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    flex: 1,
  }
});
