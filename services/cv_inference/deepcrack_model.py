import torch
import torch.nn.functional as F
from torch import nn


def conv3x3(in_channels, out_channels):
    return torch.nn.Conv2d(in_channels, out_channels, 3, padding=1)


class ConvRelu(nn.Module):
    def __init__(self, in_channels, out_channels):
        super().__init__()
        self.conv = conv3x3(in_channels, out_channels)
        self.activation = torch.nn.ReLU(inplace=True)

    def forward(self, tensor):
        return self.activation(self.conv(tensor))


class Down(nn.Module):
    def __init__(self, nn_block):
        super().__init__()
        self.nn = nn_block
        self.maxpool_with_argmax = torch.nn.MaxPool2d(
            kernel_size=2,
            stride=2,
            return_indices=True,
        )

    def forward(self, tensor):
        down = self.nn(tensor)
        unpooled_shape = down.size()
        pooled, indices = self.maxpool_with_argmax(down)
        return pooled, down, indices, unpooled_shape


class Up(nn.Module):
    def __init__(self, nn_block):
        super().__init__()
        self.nn = nn_block
        self.unpool = torch.nn.MaxUnpool2d(2, 2)

    def forward(self, tensor, indices, output_shape):
        upsampled = self.unpool(tensor, indices=indices, output_size=output_shape)
        return self.nn(upsampled)


class Fuse(nn.Module):
    def __init__(self, nn_block, scale):
        super().__init__()
        self.nn = nn_block
        self.scale = scale
        self.conv = conv3x3(64, 1)

    def forward(self, down_tensor, up_tensor):
        merged = torch.cat([down_tensor, up_tensor], 1)
        merged = F.interpolate(merged, scale_factor=self.scale, mode="bilinear")
        merged = self.nn(merged)
        return self.conv(merged)


class DeepCrack(nn.Module):
    def __init__(self):
        super().__init__()

        self.down1 = Down(
            torch.nn.Sequential(
                ConvRelu(3, 64),
                ConvRelu(64, 64),
            )
        )
        self.down2 = Down(
            torch.nn.Sequential(
                ConvRelu(64, 128),
                ConvRelu(128, 128),
            )
        )
        self.down3 = Down(
            torch.nn.Sequential(
                ConvRelu(128, 256),
                ConvRelu(256, 256),
                ConvRelu(256, 256),
            )
        )
        self.down4 = Down(
            torch.nn.Sequential(
                ConvRelu(256, 512),
                ConvRelu(512, 512),
                ConvRelu(512, 512),
            )
        )
        self.down5 = Down(
            torch.nn.Sequential(
                ConvRelu(512, 512),
                ConvRelu(512, 512),
                ConvRelu(512, 512),
            )
        )

        self.up1 = Up(
            torch.nn.Sequential(
                ConvRelu(64, 64),
                ConvRelu(64, 64),
            )
        )
        self.up2 = Up(
            torch.nn.Sequential(
                ConvRelu(128, 128),
                ConvRelu(128, 64),
            )
        )
        self.up3 = Up(
            torch.nn.Sequential(
                ConvRelu(256, 256),
                ConvRelu(256, 256),
                ConvRelu(256, 128),
            )
        )
        self.up4 = Up(
            torch.nn.Sequential(
                ConvRelu(512, 512),
                ConvRelu(512, 512),
                ConvRelu(512, 256),
            )
        )
        self.up5 = Up(
            torch.nn.Sequential(
                ConvRelu(512, 512),
                ConvRelu(512, 512),
                ConvRelu(512, 512),
            )
        )

        self.fuse5 = Fuse(ConvRelu(512 + 512, 64), scale=16)
        self.fuse4 = Fuse(ConvRelu(512 + 256, 64), scale=8)
        self.fuse3 = Fuse(ConvRelu(256 + 128, 64), scale=4)
        self.fuse2 = Fuse(ConvRelu(128 + 64, 64), scale=2)
        self.fuse1 = Fuse(ConvRelu(64 + 64, 64), scale=1)

        self.final = conv3x3(5, 1)

    def forward(self, tensor):
        out, down1, indices_1, shape1 = self.down1(tensor)
        out, down2, indices_2, shape2 = self.down2(out)
        out, down3, indices_3, shape3 = self.down3(out)
        out, down4, indices_4, shape4 = self.down4(out)
        out, down5, indices_5, shape5 = self.down5(out)

        up5 = self.up5(out, indices=indices_5, output_shape=shape5)
        up4 = self.up4(up5, indices=indices_4, output_shape=shape4)
        up3 = self.up3(up4, indices=indices_3, output_shape=shape3)
        up2 = self.up2(up3, indices=indices_2, output_shape=shape2)
        up1 = self.up1(up2, indices=indices_1, output_shape=shape1)

        fuse5 = self.fuse5(down_tensor=down5, up_tensor=up5)
        fuse4 = self.fuse4(down_tensor=down4, up_tensor=up4)
        fuse3 = self.fuse3(down_tensor=down3, up_tensor=up3)
        fuse2 = self.fuse2(down_tensor=down2, up_tensor=up2)
        fuse1 = self.fuse1(down_tensor=down1, up_tensor=up1)

        output = self.final(torch.cat([fuse5, fuse4, fuse3, fuse2, fuse1], 1))
        return output, fuse5, fuse4, fuse3, fuse2, fuse1
