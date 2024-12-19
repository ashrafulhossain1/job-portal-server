const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())


const logger = (req, res, next) => {
    console.log('inside logger')
    next()

}

const verifyToken = (req, res, next) => {
    // console.log('inside verify token middleware', req.cookies)
    const token = req?.cookies?.token;

    if (!token) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }

    jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized Access' })
        }
        next()
    })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jkfsd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");


        // jobs related APIs
        const jobsCollection = client.db('jobsPoral').collection('jobs')
        const jobApplicationCollection = client.db('jobsPoral').collection('job-applications')

        // auth related API
        app.post('/jwt', async (req, res) => {
            // const user = req.body;
            // const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '1h' })
            // res
            //     .cookie('token', token, {
            //         httpOnly: true,
            //         secure: false, // if http (false) for development, if https (true) for production

            //     })
            //     .send({ success: true })

            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' })
            res.cookie('token', token, {
                httpOnly: true,
                secure: false,
            })
                .send({ success: true })
        })


        // jobs related APIs / 
        // 1. all jobs for "home page"
        // 2. my jobs from "my posted Jobs page" admin  of job holder
        app.get('/jobs', logger, async (req, res) => {
            console.log('now inside the get jobs api')
            const email = req.query.email;
            let query = {}
            if (email) {
                query = { hr_email: email }
            }
            const cursor = jobsCollection.find(query);
            const result = await cursor.toArray()
            res.send(result)
        })


        // for details page one job details and apply button 
        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(query)
            res.send(result)
        })



        // new job post from client with her email
        app.post('/jobs', async (req, res) => {
            const newJobs = req.body;
            const result = await jobsCollection.insertOne(newJobs)
            res.send(result);
        })

        // job application Apis
        // get all data, get one data some data [0,1,,many]

        // my applications ==>>> by email 
        // with take job details by aggregate 82 no line
        app.get('/job-applications', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { applicantEmail: email }

            const result = await jobApplicationCollection.find(query).toArray()

            // Fokira way to aggregate data

            for (const application of result) {
                const query1 = { _id: new ObjectId(application.job_id) }
                const job = await jobsCollection.findOne(query1);
                if (job) {
                    application.title = job.title;
                    application.company = job.company;
                    application.company_logo = job.company_logo;
                    application.location = job.location;
                }
            }
            res.send(result);
        })

        // app.get('/job-applications/:id')==> get a specific job applications by id 

        // // 2. my jobs from "my posted Jobs page" admin  of job holder
        // 3. my posted jobs page page to all applied applicants list 
        // find by job_id 
        app.get('/job-applications/jobs/:job_id', async (req, res) => {
            const jobId = req.params.job_id;
            const query = { job_id: jobId }
            const result = await jobApplicationCollection.find(query).toArray()
            res.send(result)
        })

        // any new application add in DB and with increment count
        app.post('/job-applications', async (req, res) => {
            const application = req.body;
            const result = await jobApplicationCollection.insertOne(application)

            // how many person were apply in this job
            // skip--> it
            const id = application.job_id
            const query = { _id: new ObjectId(id) }
            const job = await jobsCollection.findOne(query)
            console.log(job)

            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1;
            }
            else {
                newCount = 1
            }
            // update job info ==> count
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    applicationCount: newCount
                }
            }
            const updatedResult = await jobsCollection.updateOne(filter, updatedDoc)


            res.send(result);
        })


        app.patch('/job-applications/:id', async (req, res) => {
            const id = req.params.id;
            const data = req.body;
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: data.status
                }
            }
            const result = await jobApplicationCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })


    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Job is falling from the sky')
})

app.listen(port, () => {
    console.log(`job is waiting at: ${port}`)
})
