let Ip2Region: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Ip2Region = require('ts-ip2region2').Ip2Region;
} catch {
  Ip2Region = null;
}

export class Ip2RegionService {
  private static instance: Ip2RegionService;
  private readonly v4Searcher: any;
  private readonly v6Searcher: any;

  private constructor() {
    if (!Ip2Region) {
      this.v4Searcher = null;
      this.v6Searcher = null;
      return;
    }
    this.v4Searcher = new Ip2Region({
      cachePolicy: 'vectorIndex',
      ipVersion: 'v4',
    });
    this.v6Searcher = new Ip2Region({
      cachePolicy: 'vectorIndex',
      ipVersion: 'v6',
    });
  }

  static getInstance(): Ip2RegionService {
    if (!Ip2RegionService.instance) {
      Ip2RegionService.instance = new Ip2RegionService();
    }
    return Ip2RegionService.instance;
  }

  static isV4(ip: string) {
    return ip.split('.').length === 4;
  }

  private static formatIpInfo(ipInfo: string): string {
    if (!ipInfo) return 'Unknown';

    const parts = ipInfo.split('|');

    if (
      parts.length >= 4 &&
      parts[1] === '0' &&
      parts[2] === '0' &&
      parts[3] === '0'
    ) {
      return parts[0];
    }

    const nonZeroParts = parts.filter((part) => part !== '0' && part !== '');
    return nonZeroParts.join('-');
  }

  static search(ip: string) {
    const instance = Ip2RegionService.getInstance();
    const searcher = Ip2RegionService.isV4(ip)
      ? instance.v4Searcher
      : instance.v6Searcher;

    try {
      if (!searcher) return 'Unknown';
      const { region } = searcher.search(ip);
      return Ip2RegionService.formatIpInfo(region);
    } catch {
      return 'Unknown';
    }
  }
}
