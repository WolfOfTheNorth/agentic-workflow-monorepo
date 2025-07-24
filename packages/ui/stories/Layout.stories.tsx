import type { Meta, StoryObj } from '@storybook/react';
import { Container, Flex, Grid, Stack } from '../src/components/Layout';

const meta = {
  title: 'Components/Layout',
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;

export const ContainerExample: StoryObj = {
  render: () => (
    <div className='bg-gray-100 p-8'>
      <Container>
        <div className='bg-white p-4 rounded border'>
          <h2 className='text-lg font-semibold'>Container</h2>
          <p>This content is contained within a responsive container.</p>
        </div>
      </Container>
    </div>
  ),
};

export const FlexExample: StoryObj = {
  render: () => (
    <div className='bg-gray-100 p-8'>
      <Flex
        direction='row'
        justify='between'
        align='center'
        className='bg-white p-4 rounded border'
      >
        <div className='bg-blue-100 p-2 rounded'>Item 1</div>
        <div className='bg-green-100 p-2 rounded'>Item 2</div>
        <div className='bg-red-100 p-2 rounded'>Item 3</div>
      </Flex>
    </div>
  ),
};

export const GridExample: StoryObj = {
  render: () => (
    <div className='bg-gray-100 p-8'>
      <Grid cols={3} gap={4} className='bg-white p-4 rounded border'>
        <div className='bg-blue-100 p-4 rounded text-center'>Grid Item 1</div>
        <div className='bg-green-100 p-4 rounded text-center'>Grid Item 2</div>
        <div className='bg-red-100 p-4 rounded text-center'>Grid Item 3</div>
        <div className='bg-yellow-100 p-4 rounded text-center'>Grid Item 4</div>
        <div className='bg-purple-100 p-4 rounded text-center'>Grid Item 5</div>
        <div className='bg-pink-100 p-4 rounded text-center'>Grid Item 6</div>
      </Grid>
    </div>
  ),
};

export const StackExample: StoryObj = {
  render: () => (
    <div className='bg-gray-100 p-8'>
      <Stack spacing={4} className='bg-white p-4 rounded border max-w-md'>
        <div className='bg-blue-100 p-3 rounded'>Stack Item 1</div>
        <div className='bg-green-100 p-3 rounded'>Stack Item 2</div>
        <div className='bg-red-100 p-3 rounded'>Stack Item 3</div>
      </Stack>
    </div>
  ),
};
