import { CronJob } from 'cron';

const job = new CronJob(
	'* * * * * *', // cronTime
	async function () {
       const response = await fetch('http://localhost:3000/api/cron/process-queue',{
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer my-super-secret-cron-key-12345`
        }
    });
       const data = await response.json();
       console.log('Cron job executed');
       console.log(data);

    }, // onTick
    null, // onComplete
    true, // start
    'America/Los_Angeles' // timeZone
);

job.start();

console.log('Cron job started');