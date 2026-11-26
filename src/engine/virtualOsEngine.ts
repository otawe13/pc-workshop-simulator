import { PCBuildState, VirtualNetworkConfig } from '../types/game';
import { getHardwareItem } from './hardwareDatabase';

export function createDefaultNetworkConfig(broken = false): VirtualNetworkConfig {
  if (broken) {
    return {
      adapterName: 'Realtek PCIe 2.5GbE Family Controller',
      linkStatus: 'Limited',
      mode: 'static',
      ipv4Address: '169.254.14.88',
      subnetMask: '255.255.0.0',
      gateway: '0.0.0.0',
      dnsPrimary: '0.0.0.0',
      dnsSecondary: '',
      linkSpeedMbps: 100,
      packetLossPct: 100,
    };
  }
  return {
    adapterName: 'Intel(R) Ethernet Controller I225-V',
    linkStatus: 'Connected',
    mode: 'dhcp',
    ipv4Address: '192.168.1.45',
    subnetMask: '255.255.255.0',
    gateway: '192.168.1.1',
    dnsPrimary: '8.8.8.8',
    dnsSecondary: '1.1.1.1',
    linkSpeedMbps: 1000,
    packetLossPct: 0,
  };
}

export function isValidIPv4(ip: string): boolean {
  const trimmed = ip.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

export function evaluateNetworkHealth(build: PCBuildState): {
  online: boolean;
  reasonId: string;
  reasonEn: string;
} {
  const net = build.networkConfig ?? createDefaultNetworkConfig();
  const hasNetworkFault = build.faults.some((f) => !f.resolved && f.type === 'network_issue');

  if (!build.drivers.network) {
    return {
      online: false,
      reasonId: 'Driver Jaringan (LAN/Wi-Fi) belum terpasang di Device Manager.',
      reasonEn: 'Network Adapter driver is not installed yet.',
    };
  }
  if (hasNetworkFault) {
    return {
      online: false,
      reasonId: 'Konfigurasi adapter / profil IPv4 bermasalah — jalankan Network Troubleshooter.',
      reasonEn: 'Adapter configuration / IPv4 profile fault detected — run Network Troubleshooter.',
    };
  }
  if (net.linkStatus === 'Disconnected') {
    return {
      online: false,
      reasonId: 'Status adapter terputus (Disconnected).',
      reasonEn: 'Network adapter is currently disconnected.',
    };
  }
  if (
    net.linkStatus === 'Limited' ||
    net.ipv4Address.startsWith('169.254.') ||
    !isValidIPv4(net.ipv4Address) ||
    !isValidIPv4(net.gateway) ||
    net.gateway === '0.0.0.0' ||
    !isValidIPv4(net.dnsPrimary) ||
    net.dnsPrimary === '0.0.0.0'
  ) {
    return {
      online: false,
      reasonId: 'Konfigurasi IPv4 / Gateway / DNS tidak valid (APIPA 169.254.x.x atau Gateway kosong).',
      reasonEn: 'Invalid IPv4 / Default Gateway / DNS configuration (APIPA or missing gateway).',
    };
  }
  return {
    online: true,
    reasonId: `Terhubung ke jaringan bengkel (${net.linkSpeedMbps} Mbps · ${net.mode.toUpperCase()})`,
    reasonEn: `Connected to workshop network (${net.linkSpeedMbps} Mbps · ${net.mode.toUpperCase()})`,
  };
}

export function repairNetworkWithTroubleshooter(build: PCBuildState): {
  nextBuild: PCBuildState;
  steps: string[];
} {
  const cleanNet = createDefaultNetworkConfig(false);
  const steps = [
    '1. Checking physical Ethernet / PCIe NIC link... OK (1000 Mbps Full Duplex)',
    '2. Verifying Network Adapter Driver state... ' + (build.drivers.network ? 'OK' : 'Auto-restored basic LAN driver'),
    '3. Flushing stale APIPA lease & resetting TCP/IP stack (ipconfig /renew)... Done',
    `4. Assigned valid DHCP lease: ${cleanNet.ipv4Address}, GW ${cleanNet.gateway}, DNS ${cleanNet.dnsPrimary}`,
    '5. Verifying ICMP reachability to 8.8.8.8... 4 packets transmitted, 0% loss.',
  ];
  return {
    nextBuild: {
      ...build,
      drivers: { ...build.drivers, network: true },
      networkConfig: cleanNet,
      faults: build.faults.map((f) =>
        f.type === 'network_issue' ? { ...f, resolved: true } : f
      ),
    },
    steps,
  };
}

export interface CmdExecutionResult {
  outputLines: string[];
  clearScreen?: boolean;
  closeWindow?: boolean;
}

export function executeVirtualCmdCommand(rawInput: string, build: PCBuildState): CmdExecutionResult {
  const trimmed = rawInput.trim();
  const cmd = trimmed.toLowerCase();
  const osName = build.osState.installedOS ?? 'Windows 11 Pro';
  const username = build.osState.oobeUsername || 'Teknisi';
  const hostname = build.osState.oobeComputerName || 'BENGKEL-PC';
  const net = build.networkConfig ?? createDefaultNetworkConfig();
  const health = evaluateNetworkHealth(build);
  const cpu = getHardwareItem(build.cpuId);

  if (!trimmed) {
    return { outputLines: [] };
  }

  if (cmd === 'cls' || cmd === 'clear') {
    return { outputLines: [], clearScreen: true };
  }

  if (cmd === 'exit') {
    return { outputLines: ['Closing Command Prompt...'], closeWindow: true };
  }

  if (cmd === 'help') {
    return {
      outputLines: [
        'PC Workshop OS Simulated Shell — Supported Commands:',
        '  HELP           Displays help information for internal commands.',
        '  CLS            Clears the terminal screen.',
        '  IPCONFIG       Displays basic IPv4, Subnet Mask, and Default Gateway.',
        '  IPCONFIG /ALL  Displays full virtual NIC, MAC, DHCP, and DNS servers.',
        '  PING <host>    Simulates ICMP echo test (try: ping 8.8.8.8 or ping localhost).',
        '  HOSTNAME       Prints the configured computer host name.',
        '  WHOAMI         Prints the current virtual user account.',
        '  VER            Displays the simulated Operating System version.',
        '  DIR            Lists virtual files in C:\\Users\\' + username,
        '  EXIT           Closes this Command Prompt window.',
      ],
    };
  }

  if (cmd === 'ver') {
    return {
      outputLines: [`Microsoft ${osName} [Virtual Sim Version 10.0.22631.4169] — CPU: ${cpu?.model ?? 'Generic x64'}`],
    };
  }

  if (cmd === 'hostname') {
    return { outputLines: [hostname] };
  }

  if (cmd === 'whoami') {
    return { outputLines: [`${hostname.toLowerCase()}\\${username.toLowerCase()}`] };
  }

  if (cmd === 'dir') {
    const driverCount = Object.values(build.drivers).filter(Boolean).length;
    return {
      outputLines: [
        ` Volume in drive C is ${hostname}_SYS`,
        ` Directory of C:\\Users\\${username}`,
        '',
        '25/11/2026  09:00    <DIR>          Desktop',
        '25/11/2026  09:00    <DIR>          Documents',
        '25/11/2026  09:00    <DIR>          Downloads',
        `25/11/2026  09:15             1,420 hw_diagnostics_log.txt (${driverCount}/6 drivers)`,
        `25/11/2026  09:20               512 ${build.benchmarks ? 'benchmark_report.json' : 'setup_readme.txt'}`,
        '               2 File(s)          1,932 bytes',
        '               3 Dir(s)    421,880,192 bytes free',
      ],
    };
  }

  if (cmd === 'ipconfig') {
    if (!build.drivers.network) {
      return {
        outputLines: [
          'Windows IP Configuration',
          '',
          'No operational network adapters detected (Missing Network Driver).',
        ],
      };
    }
    return {
      outputLines: [
        'Windows IP Configuration',
        '',
        `Ethernet adapter ${net.adapterName}:`,
        `   Connection-specific DNS Suffix  . : workshop.local`,
        `   Media State . . . . . . . . . . . : ${net.linkStatus === 'Disconnected' ? 'Media disconnected' : 'Connected'}`,
        `   IPv4 Address. . . . . . . . . . . : ${net.ipv4Address}`,
        `   Subnet Mask . . . . . . . . . . . : ${net.subnetMask}`,
        `   Default Gateway . . . . . . . . . : ${net.gateway}`,
      ],
    };
  }

  if (cmd === 'ipconfig /all') {
    if (!build.drivers.network) {
      return {
        outputLines: [
          'Windows IP Configuration',
          `   Host Name . . . . . . . . . . . . : ${hostname}`,
          '   Network Adapter . . . . . . . . . : Driver missing / Not initialized',
        ],
      };
    }
    return {
      outputLines: [
        'Windows IP Configuration',
        '',
        `   Host Name . . . . . . . . . . . . : ${hostname}`,
        `   Primary Dns Suffix  . . . . . . . : workshop.local`,
        `   Node Type . . . . . . . . . . . . : Hybrid`,
        '',
        `Ethernet adapter ${net.adapterName}:`,
        `   Description . . . . . . . . . . . : ${net.adapterName}`,
        `   Physical Address. . . . . . . . . : 04-D4-C4-9A-3F-12`,
        `   DHCP Enabled. . . . . . . . . . . : ${net.mode === 'dhcp' ? 'Yes' : 'No (Static IPv4)'}`,
        `   Link Status . . . . . . . . . . . : ${net.linkStatus} (${net.linkSpeedMbps} Mbps)`,
        `   IPv4 Address. . . . . . . . . . . : ${net.ipv4Address}`,
        `   Subnet Mask . . . . . . . . . . . : ${net.subnetMask}`,
        `   Default Gateway . . . . . . . . . : ${net.gateway}`,
        `   DNS Servers . . . . . . . . . . . : ${net.dnsPrimary}${net.dnsSecondary ? ', ' + net.dnsSecondary : ''}`,
      ],
    };
  }

  if (cmd.startsWith('ping ')) {
    const target = trimmed.slice(5).trim();
    if (!target) {
      return { outputLines: ['Usage: ping <target_host> (e.g. ping 8.8.8.8 or ping localhost)'] };
    }
    if (target === 'localhost' || target === '127.0.0.1') {
      return {
        outputLines: [
          `Pinging ${hostname} [127.0.0.1] with 32 bytes of data:`,
          'Reply from 127.0.0.1: bytes=32 time<1ms TTL=128',
          'Reply from 127.0.0.1: bytes=32 time<1ms TTL=128',
          'Reply from 127.0.0.1: bytes=32 time<1ms TTL=128',
          'Reply from 127.0.0.1: bytes=32 time<1ms TTL=128',
          '',
          'Ping statistics for 127.0.0.1: Sent = 4, Received = 4, Lost = 0 (0% loss).',
        ],
      };
    }

    if (!health.online) {
      return {
        outputLines: [
          `Pinging ${target} with 32 bytes of data:`,
          'PING: transmit failed. General failure / Destination host unreachable.',
          'Request timed out.',
          'Request timed out.',
          `Diagnostic hint: ${health.reasonEn}`,
        ],
      };
    }

    return {
      outputLines: [
        `Pinging ${target} with 32 bytes of data:`,
        `Reply from ${target}: bytes=32 time=14ms TTL=117`,
        `Reply from ${target}: bytes=32 time=13ms TTL=117`,
        `Reply from ${target}: bytes=32 time=15ms TTL=117`,
        `Reply from ${target}: bytes=32 time=14ms TTL=117`,
        '',
        `Ping statistics for ${target}:`,
        '    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),',
        'Approximate round trip times in milli-seconds: Minimum = 13ms, Maximum = 15ms, Average = 14ms',
      ],
    };
  }

  return {
    outputLines: [`'${trimmed.split(' ')[0]}' is not recognized as an internal or external command. Type HELP to see supported commands.`],
  };
}
