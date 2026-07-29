import type { ReactNode } from 'react';
import Box from '@mui/material/Box';

type PageFooterProps = {
  children: ReactNode;
};

function PageFooter({ children }: PageFooterProps) {
  return (
    <Box
      component="footer"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        px: 4,
        py: 3,
        zIndex: 1100,
      }}
    >
      <Box sx={{ maxWidth: 480, mx: 'auto' }}>{children}</Box>
    </Box>
  );
}

export default PageFooter;
