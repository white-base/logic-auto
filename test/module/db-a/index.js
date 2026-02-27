import { SQLContext } from 'logic-sql-entity';

export const meta = {
  title: 'Sample DB Module A',
  description: 'Defines onboarding checklist storage backed by SQLContext.',
};

export function createDbContext(options = {}) {
  const context = new SQLContext('sampleDbA');
  if (options.connect) {
    context.connect = options.connect;
  }
  return context;
}

export default createDbContext;
