import { Command } from 'commander';
import { safeGetCvmList } from '@phala/cloud';
import { getClient } from '@/src/lib/client';
import { logger } from '@/src/utils/logger';
import { CLOUD_URL } from '@/src/utils/constants';
import chalk from 'chalk';

export const listCommand = new Command()
  .name('list')
  .alias('ls')
  .description('List all CVMs')
  .option('-j, --json', 'Output in JSON format')
  .action(async (options) => {
    try {
      const spinner = logger.startSpinner('Fetching CVMs');

      const client = await getClient();
      const result = await safeGetCvmList(client);

      spinner.stop(true);

      if (!result.success) {
        throw new Error(result.error.message);
      }

      const cvmList = result.data;
      const cvms = cvmList.items;

      if (!cvms || cvms.length === 0) {
        logger.info('No CVMs found');
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(cvms, null, 2));
        return;
      }

      for (const cvm of cvms) {
        logger.keyValueTable({
            Name: cvm.name || 'Unknown',
            "App ID": `app_${cvm.hosted?.app_id || 'unknown'}`,
            "CVM ID": cvm.hosted?.id?.replace(/-/g, '') || 'unknown',
            "Region": cvm.node?.region_identifier || 'N/A',
            Status:
              cvm.status === "running"
                ? chalk.green(cvm.status)
                : cvm.status === "stopped"
                  ? chalk.red(cvm.status)
                  : chalk.yellow(cvm.status || 'unknown'),
            "Node Info URL": cvm.hosted?.app_url || 'N/A',
            "App URL": `${CLOUD_URL}/dashboard/cvms/${cvm.hosted?.id?.replace(/-/g, '') || 'unknown'}`,
        });
        logger.break();
      }
      logger.success(`Found ${cvms.length} CVMs`);
      logger.break();
      logger.info(`Go to ${CLOUD_URL}/dashboard/ to view your CVMs`);
    } catch (error) {
      logger.error(`Failed to list CVMs: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }); 