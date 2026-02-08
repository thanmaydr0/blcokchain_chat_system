/**
 * Security Dashboard Component
 * 
 * Visual status for all security protections with toggle controls
 */

import React, { useEffect, useState } from 'react';
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    Fingerprint,
    Eye,
    EyeOff,
    Clock,
    Wifi,
    WifiOff,
    AlertTriangle,
    Trash2,
    KeyRound,
    Activity,
    CheckCircle2,
    XCircle,
    Timer,
    Skull,
} from 'lucide-react';
import { useSecurityStore, selectDaysUntilDeadMan } from '../../store/securityStore';
import {
    checkNetworkStatus,
    performAudit,
    type MessageForAudit,
    triggerPanic,
    wipeLocalData,
    checkInDeadMan,
} from '../../security';

interface SecurityDashboardProps {
    pactId?: string;
    messages?: MessageForAudit[];
    remoteRootHash?: string | null;
    onPanic?: () => void;
}

export const SecurityDashboard: React.FC<SecurityDashboardProps> = ({
    pactId,
    messages = [],
    remoteRootHash = null,
    onPanic,
}) => {
    const {
        toggles,
        setToggle,
        latestAudit,
        auditInProgress,
        setLatestAudit,
        setAuditInProgress,
        networkStatus,
        setNetworkStatus,
        screenshotAttempts,
        deadManDays,
        checkIn,
    } = useSecurityStore();

    const daysUntilDeadMan = useSecurityStore(selectDaysUntilDeadMan);
    const [showPanicConfirm, setShowPanicConfirm] = useState(false);

    // Check network on mount
    useEffect(() => {
        const checkNetwork = async () => {
            const status = await checkNetworkStatus();
            setNetworkStatus(status);
        };
        checkNetwork();

        // Recheck every 5 minutes
        const interval = setInterval(checkNetwork, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [setNetworkStatus]);

    const handleRunAudit = async () => {
        if (auditInProgress || messages.length === 0) return;

        setAuditInProgress(true);
        try {
            const result = await performAudit(messages, remoteRootHash);
            setLatestAudit(result);
        } finally {
            setAuditInProgress(false);
        }
    };

    const handleCheckIn = () => {
        checkIn();
        checkInDeadMan();
    };

    const handlePanic = async () => {
        if (!pactId) return;

        try {
            await triggerPanic(pactId);
            onPanic?.();
        } catch (error) {
            console.error('Panic failed:', error);
        }
        setShowPanicConfirm(false);
    };

    const handleWipe = async () => {
        if (confirm('This will permanently delete all local data. Are you sure?')) {
            await wipeLocalData();
        }
    };

    return (
        <div className="security-dashboard">
            <div className="security-header">
                <Shield className="icon" />
                <h2>Security Status</h2>
            </div>

            {/* Quick Status */}
            <div className="security-status-bar">
                <StatusIndicator
                    active={toggles.screenshotProtection}
                    label="Screenshot"
                    icon={toggles.screenshotProtection ? EyeOff : Eye}
                />
                <StatusIndicator
                    active={toggles.biometricUnlock}
                    label="Biometric"
                    icon={Fingerprint}
                />
                <StatusIndicator
                    active={latestAudit?.isValid ?? false}
                    label="Audit"
                    icon={latestAudit?.isValid ? ShieldCheck : ShieldAlert}
                    warning={latestAudit !== null && !latestAudit.isValid}
                />
                <StatusIndicator
                    active={networkStatus?.isVpnDetected ?? false}
                    label="VPN"
                    icon={networkStatus?.isVpnDetected ? Wifi : WifiOff}
                />
            </div>

            {/* Protection Toggles */}
            <section className="security-section">
                <h3>Protection Settings</h3>

                <ToggleRow
                    label="Screenshot Protection"
                    description="Blur content when screenshot detected"
                    checked={toggles.screenshotProtection}
                    onChange={(v) => setToggle('screenshotProtection', v)}
                    icon={EyeOff}
                />

                <ToggleRow
                    label="Biometric Unlock"
                    description="Require FaceID/TouchID to open app"
                    checked={toggles.biometricUnlock}
                    onChange={(v) => setToggle('biometricUnlock', v)}
                    icon={Fingerprint}
                />

                <ToggleRow
                    label="Per-Message Biometric"
                    description="Verify biometric for each message"
                    checked={toggles.biometricPerMessage}
                    onChange={(v) => setToggle('biometricPerMessage', v)}
                    icon={KeyRound}
                />

                <ToggleRow
                    label="Disappearing Messages"
                    description="Auto-delete after 24 hours"
                    checked={toggles.disappearingMessages}
                    onChange={(v) => setToggle('disappearingMessages', v)}
                    icon={Clock}
                />

                <ToggleRow
                    label="Anti-Surveillance"
                    description="Randomize message timing"
                    checked={toggles.antiSurveillance}
                    onChange={(v) => setToggle('antiSurveillance', v)}
                    icon={Activity}
                />

                <ToggleRow
                    label="Dummy Traffic"
                    description="Generate decoy network traffic"
                    checked={toggles.dummyTraffic}
                    onChange={(v) => setToggle('dummyTraffic', v)}
                    icon={Wifi}
                />
            </section>

            {/* Chat Audit */}
            <section className="security-section">
                <h3>Chat Integrity Audit</h3>

                <div className="audit-info">
                    {latestAudit ? (
                        <div className={`audit-result ${latestAudit.isValid ? 'valid' : 'invalid'}`}>
                            {latestAudit.isValid ? (
                                <>
                                    <CheckCircle2 className="icon" />
                                    <span>Verified: {latestAudit.messageCount} messages match</span>
                                </>
                            ) : (
                                <>
                                    <XCircle className="icon" />
                                    <span>MISMATCH DETECTED - Possible tampering</span>
                                </>
                            )}
                            <small>Last audit: {new Date(latestAudit.auditedAt).toLocaleString()}</small>
                        </div>
                    ) : (
                        <p>No audit performed yet</p>
                    )}

                    <button
                        className="btn-secondary"
                        onClick={handleRunAudit}
                        disabled={auditInProgress || messages.length === 0}
                    >
                        {auditInProgress ? 'Auditing...' : 'Run Audit'}
                    </button>
                </div>
            </section>

            {/* Network Status */}
            <section className="security-section">
                <h3>Network Security</h3>

                {networkStatus && (
                    <div className="network-info">
                        <div className="network-row">
                            <span>VPN Detected:</span>
                            <span className={networkStatus.isVpnDetected ? 'positive' : 'negative'}>
                                {networkStatus.isVpnDetected ? 'Yes ✓' : 'No'}
                            </span>
                        </div>
                        <div className="network-row">
                            <span>Tor Detected:</span>
                            <span className={networkStatus.isTorDetected ? 'positive' : ''}>
                                {networkStatus.isTorDetected ? 'Yes ✓' : 'No'}
                            </span>
                        </div>
                        <div className="network-row">
                            <span>Connection:</span>
                            <span>{networkStatus.effectiveType}</span>
                        </div>

                        {networkStatus.recommendations.length > 0 && (
                            <div className="recommendations">
                                <AlertTriangle className="icon-warn" />
                                <ul>
                                    {networkStatus.recommendations.map((rec, i) => (
                                        <li key={i}>{rec}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* Dead Man's Switch */}
            <section className="security-section">
                <h3>Dead Man's Switch</h3>

                <ToggleRow
                    label="Enable Dead Man's Switch"
                    description={`Auto-wipe after ${deadManDays} days inactive`}
                    checked={toggles.deadManSwitch}
                    onChange={(v) => setToggle('deadManSwitch', v)}
                    icon={Skull}
                    danger
                />

                {toggles.deadManSwitch && (
                    <div className="dead-man-info">
                        <div className="countdown">
                            <Timer className="icon" />
                            <span>{daysUntilDeadMan} days remaining</span>
                        </div>
                        <button className="btn-secondary" onClick={handleCheckIn}>
                            Check In Now
                        </button>
                    </div>
                )}
            </section>

            {/* Screenshot Attempts */}
            {screenshotAttempts > 0 && (
                <section className="security-section warning">
                    <AlertTriangle className="icon-warn" />
                    <span>{screenshotAttempts} screenshot attempt(s) blocked</span>
                </section>
            )}

            {/* Emergency Actions */}
            <section className="security-section emergency">
                <h3>Emergency Actions</h3>

                <div className="emergency-buttons">
                    <button
                        className="btn-danger"
                        onClick={() => setShowPanicConfirm(true)}
                        disabled={!pactId}
                    >
                        <AlertTriangle />
                        Panic: Revoke Pact
                    </button>

                    <button className="btn-danger-outline" onClick={handleWipe}>
                        <Trash2 />
                        Wipe Local Data
                    </button>
                </div>

                {showPanicConfirm && (
                    <div className="panic-confirm">
                        <p>⚠️ This will permanently revoke the pact on blockchain and delete all data. Continue?</p>
                        <div className="confirm-buttons">
                            <button className="btn-danger" onClick={handlePanic}>
                                Yes, Revoke Everything
                            </button>
                            <button className="btn-secondary" onClick={() => setShowPanicConfirm(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </section>

            <style>{`
                .security-dashboard {
                    padding: 24px;
                    max-width: 600px;
                    margin: 0 auto;
                }

                .security-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 24px;
                }

                .security-header h2 {
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                }

                .security-header .icon {
                    width: 28px;
                    height: 28px;
                    color: #10b981;
                }

                .security-status-bar {
                    display: flex;
                    gap: 16px;
                    padding: 16px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                    margin-bottom: 24px;
                }

                .security-section {
                    background: rgba(255, 255, 255, 0.03);
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 16px;
                }

                .security-section h3 {
                    margin: 0 0 16px;
                    font-size: 16px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.9);
                }

                .security-section.warning {
                    background: rgba(245, 158, 11, 0.1);
                    border: 1px solid rgba(245, 158, 11, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .security-section.emergency {
                    background: rgba(239, 68, 68, 0.05);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }

                .toggle-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }

                .toggle-row:last-child {
                    border-bottom: none;
                }

                .toggle-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .toggle-info .icon {
                    width: 20px;
                    height: 20px;
                    opacity: 0.7;
                }

                .toggle-label {
                    font-weight: 500;
                }

                .toggle-description {
                    font-size: 12px;
                    opacity: 0.6;
                }

                .toggle-switch {
                    position: relative;
                    width: 48px;
                    height: 26px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 13px;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .toggle-switch.active {
                    background: #10b981;
                }

                .toggle-switch.danger.active {
                    background: #ef4444;
                }

                .toggle-switch::after {
                    content: '';
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    width: 20px;
                    height: 20px;
                    background: white;
                    border-radius: 50%;
                    transition: transform 0.2s;
                }

                .toggle-switch.active::after {
                    transform: translateX(22px);
                }

                .status-indicator {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    flex: 1;
                }

                .status-indicator .icon {
                    width: 24px;
                    height: 24px;
                }

                .status-indicator.active .icon {
                    color: #10b981;
                }

                .status-indicator.inactive .icon {
                    color: rgba(255, 255, 255, 0.3);
                }

                .status-indicator.warning .icon {
                    color: #f59e0b;
                }

                .status-indicator span {
                    font-size: 11px;
                    opacity: 0.7;
                }

                .audit-result {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    padding: 16px;
                    border-radius: 8px;
                    margin-bottom: 16px;
                }

                .audit-result.valid {
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                }

                .audit-result.invalid {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                }

                .audit-result .icon {
                    width: 24px;
                    height: 24px;
                }

                .audit-result.valid .icon {
                    color: #10b981;
                }

                .audit-result.invalid .icon {
                    color: #ef4444;
                }

                .network-info {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .network-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                }

                .network-row .positive {
                    color: #10b981;
                }

                .network-row .negative {
                    color: rgba(255, 255, 255, 0.5);
                }

                .recommendations {
                    margin-top: 12px;
                    padding: 12px;
                    background: rgba(245, 158, 11, 0.1);
                    border-radius: 8px;
                }

                .recommendations ul {
                    margin: 8px 0 0 20px;
                    padding: 0;
                }

                .recommendations li {
                    font-size: 13px;
                    margin-bottom: 4px;
                }

                .icon-warn {
                    color: #f59e0b;
                }

                .dead-man-info {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 12px;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .countdown {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #f59e0b;
                }

                .emergency-buttons {
                    display: flex;
                    gap: 12px;
                }

                .btn-danger {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 20px;
                    background: linear-gradient(135deg, #dc2626, #991b1b);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-danger:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
                }

                .btn-danger:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-danger-outline {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 20px;
                    background: transparent;
                    color: #ef4444;
                    border: 1px solid #ef4444;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-danger-outline:hover {
                    background: rgba(239, 68, 68, 0.1);
                }

                .btn-secondary {
                    padding: 10px 16px;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .btn-secondary:hover {
                    background: rgba(255, 255, 255, 0.15);
                }

                .btn-secondary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .panic-confirm {
                    margin-top: 16px;
                    padding: 16px;
                    background: rgba(239, 68, 68, 0.1);
                    border-radius: 8px;
                }

                .panic-confirm p {
                    margin: 0 0 16px;
                }

                .confirm-buttons {
                    display: flex;
                    gap: 12px;
                }
            `}</style>
        </div>
    );
};

// Helper Components
interface StatusIndicatorProps {
    active: boolean;
    label: string;
    icon: React.ElementType;
    warning?: boolean;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
    active,
    label,
    icon: Icon,
    warning,
}) => (
    <div className={`status-indicator ${warning ? 'warning' : active ? 'active' : 'inactive'}`}>
        <Icon className="icon" />
        <span>{label}</span>
    </div>
);

interface ToggleRowProps {
    label: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon: React.ElementType;
    danger?: boolean;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
    label,
    description,
    checked,
    onChange,
    icon: Icon,
    danger,
}) => (
    <div className="toggle-row">
        <div className="toggle-info">
            <Icon className="icon" />
            <div>
                <div className="toggle-label">{label}</div>
                <div className="toggle-description">{description}</div>
            </div>
        </div>
        <div
            className={`toggle-switch ${checked ? 'active' : ''} ${danger ? 'danger' : ''}`}
            onClick={() => onChange(!checked)}
        />
    </div>
);

export default SecurityDashboard;
