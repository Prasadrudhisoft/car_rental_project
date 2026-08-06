import React from 'react';
import NotificationsPanel from '../../../components/notifications/NotificationsPanel';
import AdminSendNotificationForm from '../../../components/notifications/AdminSendNotificationForm';
import { SectionCard } from '../AdminShared';

export default function NotificationsTab() {
    return (
        <div className="admin-section">
            <SectionCard title="Send a Notification" subtitle="Reach a specific user, an entire role, or everyone on the platform.">
                <AdminSendNotificationForm />
            </SectionCard>
            <SectionCard title="My Notifications">
                <NotificationsPanel />
            </SectionCard>
        </div>
    );
}