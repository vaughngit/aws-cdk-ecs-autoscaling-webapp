import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';


function Home() {
  const [count, setCount] = useState(0);

  return (
      <Grid
        container
        spacing={0}
        direction="column"
        alignItems="center"
        justifyContent="center"
        style={{ minHeight: '100vh' }}
      >
        

        <Grid item xs={3}>
            <Box textAlign='center'>
              <Button variant='contained' onClick={() => setCount(count + 1)}>
                  Click Me
              </Button>
      </Box>
        </Grid>   
        
      </Grid> 
  )

}

export default Home;
