import { Badge } from "@/components/ui/badge";
import { useScanSessionContext } from "@/contexts/scan-session.context";
import { useScanProgress } from "@/services/sse-service";
import { toast } from "sonner";
export const ScanProgress = () => {
    const { activeSessions, removeSession } = useScanSessionContext();
    const { progress: scanProgress, error } = useScanProgress(Array.from(activeSessions.values())[0]?.sessionId);

    if (scanProgress?.type === 'scan.complete') {
        toast.success('Scan complete');
        removeSession(scanProgress.sessionId);
    }
    if (error?.type === 'error') {
        toast.error(error.error.message);
    }
    if (scanProgress?.type === 'scan.started') {
        toast.info('Scan started');
    }

    if (scanProgress?.type === 'track.complete') {
        toast.success(`${scanProgress?.data?.fileName} complete`, {
            description: `Track ${scanProgress?.data?.trackIndex} of ${scanProgress?.data?.totalTracks} successfully processed`,
        });
    }


    const firstActiveSession = Array.from(activeSessions.values())[0];
    if (!firstActiveSession) {
        return null;
    }
    const overallProgress = scanProgress?.overallProgress || firstActiveSession?.totalTracks > 0 ? (firstActiveSession?.completedTracks / firstActiveSession?.totalTracks) * 100 : 0;
    console.log(scanProgress?.overallProgress, overallProgress)
    return (
        <div>
            {scanProgress ? (
                <div className="flex items-center gap-2">
                    <span>Progress: {overallProgress ?? 0}% | {scanProgress?.data?.status} </span>
                    <Badge variant="secondary" className="text-xs">
                        Active sessions:
                        {activeSessions.size}
                    </Badge>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <span>No scan in progress</span>
                </div>
            )}
        </div>
    )
}