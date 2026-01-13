
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export const haptics = {
    impact: async (style: ImpactStyle = ImpactStyle.Light) => {
        try {
            await Haptics.impact({ style });
        } catch (e) {
            // Ignore errors on non-supported platforms
        }
    },
    notification: async (type: NotificationType = NotificationType.Success) => {
        try {
            await Haptics.notification({ type });
        } catch (e) {
            // Ignore
        }
    },
    selection: async () => {
        try {
            await Haptics.selectionChanged();
        } catch (e) {
            // Ignore
        }
    },
    vibrate: async () => {
        try {
            await Haptics.vibrate();
        } catch (e) {
            // Ignore
        }
    }
};

export { ImpactStyle, NotificationType };
