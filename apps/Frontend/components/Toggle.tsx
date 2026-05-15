import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const TIMING_MS = 280;
const TRACK_W = 52;
const TRACK_H = 28;
const THUMB = 22;
const PAD = 2;
const THUMB_TOP = (TRACK_H - THUMB) / 2;
const THUMB_TRAVEL = TRACK_W - PAD * 2 - THUMB;

export type ToggleProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  loading?: boolean;
};

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  loading = false,
}: ToggleProps) {
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, { duration: TIMING_MS });
  }, [checked, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["#d4d4d4", "#2f37ff"]
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * THUMB_TRAVEL }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ["#ffffff", "#22ff66"]
    ),
  }));

  const dimmed = disabled || loading;

  return (
    <View
      className={
        label
          ? "w-full flex-row items-center justify-between gap-3"
          : "flex-row items-center gap-2"
      }
    >
      {label ? (
        <Text className="shrink pr-2 text-[14px] font-semibold text-neutral-900">
          {label}
        </Text>
      ) : null}
      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked, disabled: dimmed }}
          disabled={dimmed}
          onPress={() => onChange(!checked)}
          hitSlop={8}
          className={`rounded-full ${dimmed ? "opacity-45" : "opacity-100"}`}
        >
          <View
            className="overflow-hidden rounded-full shadow-sm"
            style={{
              width: TRACK_W,
              height: TRACK_H,
              borderRadius: TRACK_H / 2,
              shadowColor: "#000000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12,
              shadowRadius: 2.5,
              elevation: 2,
            }}
          >
            <Animated.View
              style={[
                trackStyle,
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  borderRadius: TRACK_H / 2,
                },
              ]}
            />
            <Animated.View
              className="rounded-full"
              style={[
                thumbStyle,
                {
                  position: "absolute",
                  left: PAD,
                  top: THUMB_TOP,
                  width: THUMB,
                  height: THUMB,
                  borderRadius: THUMB / 2,
                  zIndex: 1,
                  shadowColor: "#000000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.2,
                  shadowRadius: 2,
                  elevation: 3,
                },
              ]}
            />
          </View>
        </Pressable>
        {loading ? (
          <ActivityIndicator size="small" color="#2f37ff" accessibilityLabel="Đang cập nhật" />
        ) : null}
      </View>
    </View>
  );
}
